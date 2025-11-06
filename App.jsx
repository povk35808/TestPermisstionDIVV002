import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

// --- 1. IMPORTS ពី FIREBASE ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { 
  getFirestore, collection, query, where, onSnapshot, Timestamp, 
  doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp 
} from "firebase/firestore";

// --- 2. CONFIGS ទាំងអស់ (ដូចដើម) ---
const firebaseConfig = { apiKey: "AIzaSyDjr_Ha2RxOWEumjEeSdluIW3JmyM76mVk", authDomain: "dipermisstion.firebaseapp.com", projectId: "dipermisstion", storageBucket: "dipermisstion.firebasestorage.app", messagingSenderId: "512999406057", appId: "1:512999406057:web:953a281ab9dde7a9a0f378", measurementId: "G-KDPHXZ7H4B" };
const SHEET_ID = '1_Kgl8UQXRsVATt_BOHYQjVWYKkRIBA12R-qnsBoSUzc'; 
const SHEET_NAME = 'បញ្ជឺឈ្មោះរួម'; 
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&tq=${encodeURIComponent('SELECT E, L, AA, N, G, S WHERE E IS NOT NULL OFFSET 0')}`;

const BOT_TOKEN = '8284240201:AAEDRGHDcuoQAhkWk7km6I-9csZNbReOPHw';
const CHAT_ID = '1487065922';
const canvasAppId = 'default-app-id'; // (អាចប្តូរតាម __app_id ពេលក្រោយ)
const leaveRequestsCollectionPath = `/artifacts/${canvasAppId}/public/data/leave_requests`;
const outRequestsCollectionPath = `/artifacts/${canvasAppId}/public/data/out_requests`;

// --- 3. APP CONTEXT (ខួរក្បាលរបស់ App) ---
const AppContext = createContext();

function AppProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsersData, setAllUsersData] = useState([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [criticalError, setCriticalError] = useState(null);

  // State សម្រាប់ Smart Feature (បិទ/បើកប៊ូតុង)
  const [isLeaveButtonDisabled, setIsLeaveButtonDisabled] = useState(false);
  const [isOutButtonDisabled, setIsOutButtonDisabled] = useState(false);

  // 1. Firebase Init & Auth
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setAuth(authInstance);
      setDb(dbInstance);

      signInAnonymously(authInstance).catch(anonError => {
        console.error("Error during anonymous sign-in:", anonError);
        setCriticalError(`Critical Error: មិនអាច Sign In បានទេ។ ${anonError.message}`);
      });

      onAuthStateChanged(authInstance, (user) => {
        if (user) {
          const rememberedUser = localStorage.getItem('leaveAppUser');
          if (rememberedUser) {
            try {
              const parsedUser = JSON.parse(rememberedUser);
              if (parsedUser && parsedUser.id) {
                setCurrentUser(parsedUser);
              }
            } catch (e) { localStorage.removeItem('leaveAppUser'); }
          }
        } else {
          setCurrentUser(null);
          localStorage.removeItem('leaveAppUser');
        }
        setIsInitializing(false);
      });

    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      setCriticalError(`Critical Error: មិនអាចតភ្ជាប់ Firebase បានទេ។ ${e.message}`);
      setIsInitializing(false);
    }
  }, []);

  // 2. Fetch Users from Google Sheet
  useEffect(() => {
    async function fetchUsers() {
      setIsFetchingUsers(true);
      try {
        const response = await fetch(GVIZ_URL);
        if (!response.ok) throw new Error(`Google Sheet fetch failed: ${response.status} (Check 'Publish to web')`);
        const text = await response.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
        if (!match || !match[1]) throw new Error("ទម្រង់ការឆ្លើយតបពី Google Sheet មិនត្រឹមត្រូវ");
        const json = JSON.parse(match[1]);
        if (json.table && json.table.rows && json.table.rows.length > 0) {
          const users = json.table.rows.map(row => ({
            id: row.c?.[0]?.v ?? null, name: row.c?.[1]?.v ?? null, photo: row.c?.[2]?.v ?? null,
            gender: row.c?.[3]?.v ?? null, group: row.c?.[4]?.v ?? null, department: row.c?.[5]?.v ?? null
          }));
          setAllUsersData(users);
        } else { throw new Error("រកមិនឃើញទិន្នន័យអ្នកប្រើប្រាស់"); }
      } catch (error) {
        console.error("Error ពេលទាញយកទិន្នន័យ Google Sheet:", error);
        setCriticalError(`Error: មិនអាចទាញយកបញ្ជីបុគ្គលិកបានទេ។\n${error.message}\n\nសូមប្រាកដថា Google Sheet របស់អ្នកបាន 'Publish to the web'។`);
      }
      setIsFetchingUsers(false);
    }
    if(isInitializing === false) { fetchUsers(); }
  }, [isInitializing]);
  
  // 3. Real-time Listener សម្រាប់ Smart Feature
  useEffect(() => {
    if (!db || !currentUser) return; // មិនទាន់ Login ឬ Logout

    const now = new Date();
    const startTimestamp = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const endTimestamp = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    
    const leaveQuery = query(collection(db, leaveRequestsCollectionPath), where("userId", "==", currentUser.id), where("requestedAt", ">=", startTimestamp), where("requestedAt", "<", endTimestamp));
    const unsubscribeLeave = onSnapshot(leaveQuery, (snapshot) => {
        let hasPending = snapshot.docs.some(doc => doc.data().status === 'pending' || doc.data().status === 'editing');
        setIsLeaveButtonDisabled(hasPending);
    }, (error) => console.error("Leave Listener Error:", error));

    const outQuery = query(collection(db, outRequestsCollectionPath), where("userId", "==", currentUser.id), where("requestedAt", ">=", startTimestamp), where("requestedAt", "<", endTimestamp));
    const unsubscribeOut = onSnapshot(outQuery, (snapshot) => {
        const requests = snapshot.docs.map(doc => doc.data());
        let hasPending = requests.some(r => r.status === 'pending' || r.status === 'editing');
        let hasActive = requests.some(r => r.status === 'approved' && r.returnStatus !== 'បានចូលមកវិញ');
        setIsOutButtonDisabled(hasPending || hasActive);
    }, (error) => console.error("Out Listener Error:", error));

    return () => {
        unsubscribeLeave();
        unsubscribeOut();
    };
  }, [db, currentUser]);

  // 4. Login / Logout Functions
  const loginUser = (user) => { setCurrentUser(user); };
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('leaveAppUser');
  };

  // 5. បញ្ជូន (Provide) ទិន្នន័យទាំងអស់
  const value = {
    auth, db, currentUser, allUsersData, isFetchingUsers, isInitializing, criticalError,
    loginUser, logout, BOT_TOKEN, CHAT_ID, leaveRequestsCollectionPath, outRequestsCollectionPath,
    isLeaveButtonDisabled, isOutButtonDisabled,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  return useContext(AppContext);
};

// --- 4. HELPER FUNCTIONS (ពី App.js ចាស់) ---

// FaceAPI Hook (បំប្លែងទៅជា Function ធម្មតា)
function useFaceApi() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [modelStatus, setModelStatus] = useState('កំពុងទាញយក Model ស្កេនមុខ...');
  const faceapi = window.faceapi;

  useEffect(() => {
    const loadModels = async () => {
      if (!faceapi) {
        setModelStatus('Error: face-api.js មិនអាចទាញយកបាន');
        return;
      }
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/weights'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/weights'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/weights'),
        ]);
        setModelStatus('Model ស្កេនមុខបានទាញយករួចរាល់');
        setIsModelLoaded(true);
      } catch (error) {
        setModelStatus('Error: មិនអាចទាញយក Model បាន');
      }
    };
    loadModels();
  }, [faceapi]);

  const getReferenceDescriptor = async (userPhotoUrl) => {
    if (!userPhotoUrl) throw new Error("Missing user photo URL");
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = userPhotoUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = (err) => reject(new Error('Failed to fetch (មិនអាចទាញយករូបថតយោងបាន)'));
    });
    const referenceDetection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true).withFaceDescriptor();
    if (!referenceDetection) throw new Error('រកមិនឃើញមុខនៅក្នុងរូបថតយោង');
    return referenceDetection.descriptor;
  };

  const startFaceScan = async ({ videoEl, referenceDescriptor, onScanStatus, onScanDebug, onSuccess }) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    videoEl.srcObject = stream;
    const scanInterval = setInterval(async () => {
      if (!videoEl || videoEl.readyState < 3) return;
      const detections = await faceapi.detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true).withFaceDescriptor();
      if (detections) {
        onScanStatus('រកឃើញផ្ទៃមុខ! កំពុងផ្ទៀងផ្ទាត់...');
        const distance = faceapi.euclideanDistance(referenceDescriptor, detections.descriptor);
        const similarity = (1 - distance).toFixed(2);
        const threshold = 0.55;
        onScanDebug(`ភាពស្រដៀងគ្នា: ${similarity} (ត្រូវតែ > ${1-threshold})`);
        if (distance < threshold) {
          onScanStatus('ផ្ទៀងផ្ទាត់ជោគជ័យ!');
          onSuccess();
        } else {
          onScanStatus('មុខមិនត្រឹមត្រូវ... សូមព្យាយាមម្តងទៀត');
        }
      } else {
        onScanStatus('រកមិនឃើញផ្ទៃមុខ...');
        onScanDebug('');
      }
    }, 500);
    return scanInterval;
  };

  const stopScan = (intervalId, videoEl) => {
    if (intervalId) clearInterval(intervalId);
    if (videoEl && videoEl.srcObject) {
      videoEl.srcObject.getTracks().forEach(track => track.stop());
      videoEl.srcObject = null;
    }
  };

  return { isModelLoaded, modelStatus, getReferenceDescriptor, startFaceScan, stopScan };
}

// Date Helpers (ពី App.js ចាស់)
function getTodayString(format = 'yyyy-mm-dd') { const today = new Date(); const yyyy = today.getFullYear(); const mm = String(today.getMonth() + 1).padStart(2, '0'); const dd = String(today.getDate()).padStart(2, '0'); if (format === 'dd/mm/yyyy') return `${dd}/${mm}/${yyyy}`; return `${yyyy}-${mm}-${dd}`; }
function formatDateToDdMmmYyyy(dateString) { const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; let date; if (dateString.includes('/') && dateString.split('/').length === 3) { const parts = dateString.split('/'); date = new Date(parts[2], parts[1] - 1, parts[0]); } else { date = new Date(); } if (isNaN(date.getTime())) date = new Date(); const day = String(date.getDate()).padStart(2, '0'); const month = monthNames[date.getMonth()]; const year = date.getFullYear(); return `${day}-${month}-${year}`; }
function parseDdMmmYyyyToInputFormat(ddMmmYyyy) { if (!ddMmmYyyy || ddMmmYyyy.split('-').length !== 3) return getTodayString(); const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const parts = ddMmmYyyy.split('-'); if(parts.length !== 3) return getTodayString(); const day = parts[0]; const monthIndex = monthNames.indexOf(parts[1]); const year = parts[2]; if (monthIndex === -1) return getTodayString(); const mm = String(monthIndex + 1).padStart(2, '0'); return `${year}-${mm}-${day}`; }


// --- 5. COMPONENTS ទាំងអស់ (ដាក់ក្នុង File តែមួយ) ---

// Component: SearchableDropdown
function SearchableDropdown({ items, onSelect, placeholder, initialValue = "" }) {
  const [filter, setFilter] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const filteredItems = items.filter(item => item.text && item.text.toLowerCase().includes(filter.toLowerCase()));
  useEffect(() => {
    function handleClickOutside(event) { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);
  const handleSelect = (item) => { setFilter(item.text); onSelect(item.value); setIsOpen(false); };
  const handleInputChange = (e) => { setFilter(e.target.value); const exactMatch = items.find(item => item.text === e.target.value); onSelect(exactMatch ? exactMatch.value : null); };
  return (
    <div className="relative" ref={dropdownRef}>
      <input type="text" value={filter} onChange={handleInputChange} onFocus={() => setIsOpen(true)} placeholder={placeholder} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" autoComplete="off" />
      {isOpen && filteredItems.length > 0 && (
        <div className="dropdown-list absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredItems.map((item) => ( <div key={item.value} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }} > {item.text} </div> ))}
        </div>
      )}
    </div>
  );
}

// Component: NavBar
function NavBar({ currentPage, onNavigate }) {
  const HomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>;
  const HistoryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const AccountIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>;
  const HelpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;
  const navItems = [ { id: 'page-home', label: 'ទំព័រដើម', icon: <HomeIcon /> }, { id: 'page-history', label: 'ប្រវត្តិ', icon: <HistoryIcon /> }, { id: 'page-account', label: 'គណនី', icon: <AccountIcon /> }, { id: 'page-help', label: 'ជំនួយ', icon: <HelpIcon /> }, ];
  return (
    <nav id="bottom-navigation" className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-16 bg-white border-t border-gray-200 shadow-md flex justify-around items-center">
      {navItems.map((item) => { const isActive = currentPage === item.id; const colorClass = isActive ? 'text-blue-600' : 'text-gray-500'; return ( <button key={item.id} className={`nav-btn p-2 ${colorClass}`} onClick={() => onNavigate(item.id)} > {item.icon} <span className="text-xs font-medium">{item.label}</span> </button> ); })}
    </nav>
  );
}

// Page: Home
function Home({ onNavigate }) {
  const { currentUser, isLeaveButtonDisabled, isOutButtonDisabled } = useApp();
  const leaveBtnText = isLeaveButtonDisabled ? 'មានសំណើកំពុងរង់ចាំ' : 'ឈប់សម្រាក';
  const outBtnText = isOutButtonDisabled ? 'មានសំណើកំពុងដំណើរការ' : 'ចេញក្រៅផ្ទាល់ខ្លួន';
  return (
    <div id="page-home" className="p-6">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <img src={currentUser.photo || "https://i.postimg.cc/FHBn0Fdf/di3-copy.png"} alt="Logo" className="h-10 w-10 rounded-full border" />
          <div> <p className="text-sm text-gray-500">ស្វាគមន៍</p> <h2 id="home-user-name" className="text-xl font-bold text-gray-800"> {currentUser.name} </h2> </div>
        </div>
      </header>
      <section>
        <h3 className="text-md font-semibold text-gray-700 mb-3">ប្រភេទសំណើសុំច្បាប់</h3>
        <div className="grid grid-cols-2 gap-4">
          <button id="open-leave-request-btn" className={`p-6 rounded-lg shadow-sm transition-all text-center ${isLeaveButtonDisabled ? 'bg-gray-100 text-gray-500 opacity-70 cursor-not-allowed' : 'bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100'}`} disabled={isLeaveButtonDisabled} onClick={() => onNavigate('page-request-leave')} > <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> <p className="text-base font-semibold">សុំច្បាប់ឈប់</p> <p className="text-xs">{leaveBtnText}</p> </button>
          <button id="open-out-request-btn" className={`p-6 rounded-lg shadow-sm transition-all text-center ${isOutButtonDisabled ? 'bg-gray-100 text-gray-500 opacity-70 cursor-not-allowed' : 'bg-green-50 border border-green-200 text-green-800 hover:bg-green-100'}`} disabled={isOutButtonDisabled} onClick={() => onNavigate('page-request-out')} > <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> <p className="text-base font-semibold">សុំច្បាប់ចេញក្រៅ</p> <p className="text-xs">{outBtnText}</p> </button>
        </div>
      </section>
      <section className="mt-8">
        <h3 className="text-md font-semibold text-gray-700 mb-3">ទិន្នន័យរបស់ខ្ញុំ</h3>
        <div className="grid grid-cols-1 gap-4">
          <button id="open-daily-attendance-btn" className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-6 rounded-lg shadow-sm hover:bg-indigo-100 transition-all text-left flex items-center space-x-4" onClick={() => onNavigate('page-daily-attendance')} > <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /> <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /> </svg> <div> <p className="text-base font-semibold">វត្តមានប្រចាំថ្ងៃ</p> <p className="text-xs">បើកកម្មវិធីស្កេនវត្តមាន</p> </div> </button>
        </div>
      </section>
      <section className="mt-8">
        <h3 className="text-md font-semibold text-gray-700 mb-3">អ្នកអនុញ្ញាតច្បាប់</h3>
        <div className="w-full bg-white border border-gray-300 p-4 rounded-lg shadow-sm flex items-center space-x-4"> <img src="https://i.postimg.cc/cL3wdGs8/photo-2025-09-27-15-47-14.jpg" alt="Approver" className="h-16 w-16 rounded-full border-2 border-white shadow-md object-cover" /> <div> <p className="text-lg font-semibold text-gray-800 text-left">លោកគ្រូ​ ពៅ ដារ៉ូ</p> <p className="text-sm text-gray-500 text-left">គណៈគ្រប់គ្រង</p> </div> </div>
      </section>
    </div>
  );
}

// Page: History (Placeholder)
function History() {
  return (
    <div id="page-history" className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">ប្រវត្តិសុំច្បាប់</h2>
      <p className="text-center text-sm text-gray-500 mb-6">បង្ហាញតែសំណើសម្រាប់ខែបច្ចុប្បន្នប៉ុណ្ណោះ</p>
      <div className="flex border-b border-gray-200 mb-4">
        <button id="history-tab-leave" className="history-tab flex-1 py-3 text-center font-semibold text-blue-600 border-b-2 border-blue-600"> ច្បាប់ឈប់សម្រាក </button>
        <button id="history-tab-out" className="history-tab flex-1 py-3 text-center font-semibold text-gray-500"> ច្បាប់ចេញក្រៅ </button>
      </div>
      <div id="history-content">
        <div id="history-container-leave">
          <div id="history-placeholder-leave" className="text-center text-gray-500 mt-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="mt-4 text-lg">មិនទាន់មានប្រវត្តិ</p>
            <p className="text-sm">(យើងនឹងបន្ថែម Logic នៅទីនេះ)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Page: Account
function Account() {
  const { currentUser, logout } = useApp();
  const user = currentUser || {}; 
  return (
    <div id="page-account" className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">គណនីរបស់ខ្ញុំ</h2>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex flex-col items-center">
          <img id="user-photo" src={user.photo || 'https://placehold.co/100x100/e2e8f0/64748b?text=User'} alt="User Photo" className="h-24 w-24 rounded-full border-4 border-white shadow-lg mb-4 object-cover" />
          <h3 id="user-name" className="text-xl font-bold text-gray-900">{user.name || '...'}</h3>
          <p id="user-id" className="text-sm text-gray-500">{user.id || '...'}</p>
        </div>
        <hr className="my-6 border-gray-200" />
        <div className="space-y-3">
          <div className="flex justify-between"> <span className="text-gray-500 font-medium">ភេទ:</span> <span id="user-gender" className="font-semibold text-gray-800">{user.gender || '...'}</span> </div>
          <div className="flex justify-between"> <span className="text-gray-500 font-medium">ក្រុម:</span> <span id="user-group" className="font-semibold text-gray-800">{user.group || '...'}</span> </div>
          <div className="flex justify-between"> <span className="text-gray-500 font-medium">ផ្នែកការងារ:</span> <span id="user-department" className="font-semibold text-gray-800">{user.department || '...'}</span> </div>
        </div>
      </div>
      <button id="logout-btn" onClick={logout} className="w-full bg-red-500 text-white py-3 px-4 rounded-lg font-semibold shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-150"> ចាកចេញពីគណនី </button>
    </div>
  );
}

// Page: Help
function Help() {
  return (
    <div id="page-help" className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">ជំនួយ និង ទំនាក់ទំនង</h2>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ក្រុមការងារ IT SUPPORT</h3>
        <p className="text-gray-600 mb-4">ប្រសិនបើអ្នកជួបបញ្ហាក្នុងការប្រើប្រាស់កម្មវិធី សូមទាក់ទងមកក្រុមការងារយើងខ្ញុំតាមរយៈ៖</p>
        <div className="space-y-4">
          <a href="https://t.me/MMKDigitalIndustry" target="_blank" rel="noopener noreferrer" className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200"> <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" className="h-6 w-6" /> <div className="ml-4"> <p className="font-semibold text-blue-600">Telegram</p> <p className="text-sm text-gray-600">@MMKDigitalIndustry</p> </div> </a>
          <a href="tel:090544452" className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200"> <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> <div className="ml-4"> <p className="font-semibold text-green-700">លេខទូរស័ព្ទ</p> <p className="text-sm text-gray-600">090 544 452</p> </div> </a>
          <a href="mailto:perdigitalindustry@gmail.com" className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200"> <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> <div className="ml-4"> <p className="font-semibold text-red-700">អ៊ីម៉ែល</p> <p className="text-sm text-gray-600">perdigitalindustry@gmail.com</p> </div> </a>
        </div>
      </div>
      <div className="text-center text-xs text-gray-400"> <p>&copy; 2024 ឧស្សាហកម្មឌីជីថល</p> <p>អភិវឌ្ឍន៍ដោយ ក្រុមការងារ IT SUPPORT</p> </div>
    </div>
  );
}

// Page: Login
function Login() {
  const { loginUser, allUsersData, isFetchingUsers } = useApp();
  const { isModelLoaded, modelStatus, getReferenceDescriptor, startFaceScan, stopScan } = useFaceApi();
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [userSearchError, setUserSearchError] = useState('');
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('...');
  const [scanDebug, setScanDebug] = useState('');
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const userReferenceDescriptorRef = useRef(null);
  useEffect(() => { const ua = navigator.userAgent || navigator.vendor || window.opera; const isClient = ( (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || (ua.indexOf('Twitter') > -1) || (ua.indexOf('Telegram') > -1) || (ua.indexOf('WebView') > -1) || (ua.indexOf('wv') > -1) ); if (isClient) setShowInAppWarning(true); }, []);
  const userItems = allUsersData.map(user => ({ text: `${user.id} - ${user.name}`, value: user.id }));
  const handleScanFaceClick = async () => {
    if (!selectedUserId) { setUserSearchError('សូមជ្រើសរើសអត្តលេខឲ្យបានត្រឹមត្រូវ'); return; }
    const user = allUsersData.find(u => u.id === selectedUserId);
    if (!user || !user.photo) { setUserSearchError('មិនអាចទាញយករូបថតយោងរបស់អ្នកបានទេ'); return; }
    setUserSearchError(''); setIsScanning(true); setScanStatus('កំពុងព្យាយាមបើកកាមេរ៉ា...');
    try {
      setScanStatus('កំពុងវិភាគរូបថតយោង...');
      if (!userReferenceDescriptorRef.current) { userReferenceDescriptorRef.current = await getReferenceDescriptor(user.photo); }
      setScanStatus('កំពុងស្នើសុំបើកកាមេរ៉ា...');
      scanIntervalRef.current = await startFaceScan({
        videoEl: videoRef.current, referenceDescriptor: userReferenceDescriptorRef.current,
        onScanStatus: setScanStatus, onScanDebug: setScanDebug,
        onSuccess: () => {
          stopScan(scanIntervalRef.current, videoRef.current);
          loginUser(user);
          if (rememberMe) { localStorage.setItem('leaveAppUser', JSON.stringify(user)); } else { localStorage.removeItem('leaveAppUser'); }
          setTimeout(() => setIsScanning(false), 1000);
        }
      });
    } catch (error) {
      console.error("Error during face scan process:", error); setScanStatus(`Error: ${error.message}`);
      stopScan(scanIntervalRef.current, videoRef.current); alert(`បញ្ហាស្កេនមុខ: ${error.message}`); setIsScanning(false);
    }
  };
  const handleCancelScan = () => { stopScan(scanIntervalRef.current, videoRef.current); setIsScanning(false); };
  const handleUserSelect = (userId) => { setSelectedUserId(userId); userReferenceDescriptorRef.current = null; if (userId) setUserSearchError(''); };
  const isScanButtonDisabled = !isModelLoaded || !selectedUserId;
  return (
    <>
      <div id="page-login" className="max-w-md mx-auto min-h-screen flex flex-col justify-center items-center p-6 bg-gray-50">
        <img src="https://i.postimg.cc/FHBn0Fdf/di3-copy.png" alt="Logo" className="h-20 w-20 mb-4" />
        <h1 className="text-2xl font-bold text-blue-800 mb-2">ឧស្សាហកម្មឌីជីថល</h1>
        <p className="text-gray-600 mb-8">សូមចូលប្រើកម្មវិធីសុំច្បាប់</p>
        {showInAppWarning && ( <div id="in-app-warning" className="w-full max-w-sm p-4 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm text-left mb-4"> <p className="font-bold text-base mb-2">បញ្ហាកាមេរ៉ា!</p> <p>កម្មវិធីនេះ ត្រូវការបើកកាមេរ៉ា ដែលមិនអាចដំណើរការក្នុង Telegram/Facebook បានទេ។</p> <p className="font-semibold mt-3">ដំណោះស្រាយ៖</p> <ol className="list-decimal list-inside mt-1"> <li>នៅខាងលើស្តាំ, ចុចសញ្ញា <span className="font-bold">...</span></li> <li>ជ្រើសរើស "Open in Browser" (បើកក្នុង Browser)</li> </ol> </div> )}
        {isFetchingUsers && ( <div id="data-loading-indicator" className="w-full max-w-sm p-6 bg-white rounded-lg shadow-md border border-gray-200 flex flex-col items-center justify-center"> <div className="spinner mb-4"></div> <p className="text-gray-600 font-medium">កំពុងទាញយកទិន្នន័យបុគ្គលិក...</p> </div> )}
        {!isFetchingUsers && !showInAppWarning && (
          <div id="login-form-container" className="w-full bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 mb-2">ជ្រើសរើសអត្តលេខ (ID)</label>
            <SearchableDropdown items={userItems} onSelect={handleUserSelect} placeholder="វាយ ឬ ជ្រើសរើស..." />
            {userSearchError && ( <p className="text-red-500 text-sm mt-1">{userSearchError}</p> )}
            <div className="flex items-center mt-4"> <input id="remember-me" name="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" /> <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">ចងចាំខ្ញុំនៅលើ Device នេះ</label> </div>
            <button id="scan-face-btn" onClick={handleScanFaceClick} disabled={isScanButtonDisabled} className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 flex items-center justify-center space-x-2 disabled:opacity-50"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm11 11H5V5h10v8zm-5 2a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg> <span>ចូលដោយស្កេនផ្ទៃមុខ</span> </button>
            <p id="model-status" className="text-xs text-gray-500 text-center mt-2"> {modelStatus} </p>
          </div>
        )}
      </div>
      {isScanning && ( <div id="face-scan-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"> <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md text-center"> <h3 className="text-xl font-bold mb-4">កំពុងស្កេនផ្ទៃមុខ</h3> <div className="relative w-full h-64 bg-gray-800 rounded-lg overflow-hidden border-4 border-blue-500"> <video ref={videoRef} id="video" className="w-full h-full object-cover" autoPlay muted playsInline></video> </div> <p id="scan-status" className="mt-4 text-lg font-medium text-gray-700">{scanStatus}</p> <p id="scan-debug" className="text-xs text-gray-500 h-4">{scanDebug}</p> <button id="cancel-scan-btn" onClick={handleCancelScan} className="mt-4 w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300"> បោះបង់ </button> </div> </div> )}
    </>
  );
}

// Page: MainLayout (គ្រប់គ្រងការប្តូរទំព័រ)
function MainLayout() {
  const [currentPage, setCurrentPage] = useState('page-home');
  const handleNavigate = (pageId) => {
    setCurrentPage(pageId);
    document.getElementById('main-content')?.scrollTo(0, 0);
  };
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'page-home': return <Home onNavigate={handleNavigate} />;
      case 'page-history': return <History />;
      case 'page-account': return <Account />;
      case 'page-help': return <Help />;
      // --- Placeholders សម្រាប់ទំព័រផ្សេងទៀត ---
      case 'page-request-leave': return <div className="p-6"><h1>ទំព័រសុំច្បាប់ឈប់ (នឹងបង្កើត)</h1><button className="text-blue-600" onClick={() => handleNavigate('page-home')}>&larr; ថយក្រោយ</button></div>;
      case 'page-request-out': return <div className="p-6"><h1>ទំព័រសុំច្បាប់ចេញក្រៅ (នឹងបង្កើត)</h1><button className="text-blue-600" onClick={() => handleNavigate('page-home')}>&larr; ថយក្រោយ</button></div>;
      case 'page-daily-attendance': return <div className="p-6"><h1>ទំព័រវត្តមាន (នឹងបង្កើត)</h1><button className="text-blue-600" onClick={() => handleNavigate('page-home')}>&larr; ថយក្រោយ</button></div>;
      default: return <Home onNavigate={handleNavigate} />;
    }
  };
  const showNav = ['page-home', 'page-history', 'page-account', 'page-help'].includes(currentPage);
  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg">
      <main id="main-content" className={showNav ? 'pb-20' : ''} style={{ height: '100vh', overflowY: 'auto' }} >
        {renderCurrentPage()}
      </main>
      {showNav && <NavBar currentPage={currentPage} onNavigate={handleNavigate} />}
    </div>
  );
}


// --- 6. APP COMPONENT គោល ---
function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}

function MainApp() {
  const { currentUser, isInitializing, criticalError } = useApp();

  if (criticalError) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center items-center p-6 text-center text-red-600 font-semibold whitespace-pre-line">
        {criticalError}
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center items-center p-6">
        <div className="spinner mb-4"></div>
        <p className="text-gray-600 font-medium">កំពុងរៀបចំកម្មវិធី...</p>
      </div>
    );
  }

  return currentUser ? <MainLayout /> : <Login />;
}

export default App;
