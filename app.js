import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, getDoc, collection, query, where, onSnapshot, serverTimestamp, Timestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Enable Firestore debug logging
setLogLevel('debug');

// --- Hard-coded Firebase Config ---
const firebaseConfig = { apiKey: "AIzaSyDjr_Ha2RxOWEumjEeSdluIW3JmyM76mVk", authDomain: "dipermisstion.firebaseapp.com", projectId: "dipermisstion", storageBucket: "dipermisstion.firebasestorage.app", messagingSenderId: "512999406057", appId: "1:512999406057:web:953a281ab9dde7a9a0f378", measurementId: "G-KDPHXZ7H4B" };

// --- Global State & Element References ---
let db, auth, userId;
let historyUnsubscribe = null, outHistoryUnsubscribe = null;
let allUsersData = [], currentUser = null, selectedUserId = null;
let userReferenceDescriptor = null, currentReturnRequestId = null;
let touchstartX = 0, touchendX = 0, isSwiping = false;
let selectedLeaveDuration = null;
let selectedLeaveReason = null;
let selectedOutDuration = null;
let selectedOutReason = null;

// --- START: New Face Analysis State ---
let isFaceAnalysisRunning = false;
let lastFaceCheck = 0;
// ========== START: MODIFICATION (Smoothness) ==========
// ប្រើ 500ms ព្រោះ SsdMobilenetv1 ធ្ងន់ជាង TinyDetector
// នេះជួយឲ្យកម្មវិធីរលូន (smooth) មិនគាំង (lag)
const FACE_CHECK_INTERVAL = 500; 
// ========== END: MODIFICATION (Smoothness) ==========
// --- END: New Face Analysis State ---

// المتغيرات​ថ្មី​សម្រាប់​ទំព័រ​វត្តមាន
let openDailyAttendanceBtn, attendancePage, closeAttendancePageBtn, attendanceIframe;

// --- Google Sheet Config ---
const SHEET_ID = '1_Kgl8UQXRsVATt_BOHYQjVWYKkRIBA12R-qnsBoSUzc'; const SHEET_NAME = 'បញ្ជឺឈ្មោះរួម'; const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&tq=${encodeURIComponent('SELECT E, L, AA, N, G, S WHERE E IS NOT NULL OFFSET 0')}`;
const BOT_TOKEN = '8284240201:AAEDRGHDcuoQAhkWk7km6I-9csZNbReOPHw'; const CHAT_ID = '1487065922';
let leaveRequestsCollectionPath, outRequestsCollectionPath;
const allowedAreaCoords = [ [11.417052769150015, 104.76508285291308], [11.417130005964497, 104.76457396198742], [11.413876386899489, 104.76320488118378], [11.41373800267192, 104.76361527709159] ];
const LOCATION_FAILURE_MESSAGE = "ការបញ្ជាក់ចូលមកវិញ បរាជ័យ។ \n\nប្រហែលទូរស័ព្ទអ្នកមានបញ្ហា ការកំណត់បើ Live Location ដូច្នោះអ្នកមានជម្រើសមួយទៀតគឺអ្នកអាចទៅបញ្ជាក់ដោយផ្ទាល់នៅការិយាល័យអគារ B ជាមួយក្រុមការងារលោកគ្រូ ដារ៉ូ។";

// --- Element References ---
let userSearchInput, userDropdown, userSearchError, scanFaceBtn, modelStatusEl, faceScanModal, video, scanStatusEl, scanDebugEl, cancelScanBtn, loginFormContainer, inAppWarning, dataLoadingIndicator, rememberMeCheckbox, mainAppContainer, homeUserName, loginPage, bottomNav, userPhotoEl, userNameEl, userIdEl, userGenderEl, userGroupEl, userDepartmentEl, logoutBtn, navButtons, pages, mainContent, requestLeavePage, openLeaveRequestBtn, cancelLeaveRequestBtn, submitLeaveRequestBtn, leaveDurationSearchInput, leaveDurationDropdownEl, leaveSingleDateContainer, leaveDateRangeContainer, leaveSingleDateInput, leaveStartDateInput, leaveEndDateInput, leaveRequestErrorEl, leaveRequestLoadingEl, leaveReasonSearchInput, leaveReasonDropdownEl, historyContainer, historyPlaceholder, criticalErrorDisplay, historyTabLeave, historyTabOut, historyContainerLeave, historyContainerOut, historyPlaceholderLeave, historyPlaceholderOut, historyContent, editModal, editModalTitle, editForm, editRequestId, editDurationSearch, editDurationDropdown, editSingleDateContainer, editLeaveDateSingle, editDateRangeContainer, editLeaveDateStart, editLeaveDateEnd, editReasonSearch, editReasonDropdown, editErrorEl, editLoadingEl, submitEditBtn, cancelEditBtn, deleteModal, deleteConfirmBtn, cancelDeleteBtn, deleteRequestId, deleteCollectionType, openOutRequestBtn, requestOutPage, cancelOutRequestBtn, submitOutRequestBtn, outRequestErrorEl, outRequestLoadingEl, outDurationSearchInput, outDurationDropdownEl, outReasonSearchInput, outReasonDropdownEl, outDateInput, returnScanModal, returnVideo, returnScanStatusEl, returnScanDebugEl, cancelReturnScanBtn, customAlertModal, customAlertTitle, customAlertMessage, customAlertOkBtn, customAlertIconWarning, customAlertIconSuccess, invoiceModal, closeInvoiceModalBtn, invoiceModalTitle, invoiceContentWrapper, invoiceContent, invoiceUserName, invoiceUserId, invoiceUserDept, invoiceRequestType, invoiceDuration, invoiceDates, invoiceReason, invoiceStatus, invoiceApprover, invoiceDecisionTime, invoiceRequestId, invoiceReturnInfo, invoiceReturnStatus, invoiceReturnTime, shareInvoiceBtn, invoiceShareStatus;

// --- Duration/Reason Constants ---
const leaveDurations = ["មួយព្រឹក", "មួយរសៀល", "មួយយប់", "មួយថ្ងៃ", "មួយថ្ងៃកន្លះ", "ពីរថ្ងៃ", "ពីរថ្ងៃកន្លះ", "បីថ្ងៃ", "បីថ្ងៃកន្លះ", "បួនថ្ងៃ", "បួនថ្ងៃកន្លះ", "ប្រាំថ្ងៃ", "ប្រាំថ្ងៃកន្លះ", "ប្រាំមួយថ្ងៃ", "ប្រាំមួយថ្ងៃកន្លះ", "ប្រាំពីរថ្ងៃ"]; const leaveDurationItems = leaveDurations.map(d => ({ text: d, value: d })); const leaveReasons = ["ឈឺក្បាល", "ចុកពោះ", "គ្រុនក្ដៅ", "ផ្ដាសាយ"]; const leaveReasonItems = leaveReasons.map(r => ({ text: r, value: r })); const singleDayLeaveDurations = ["មួយព្រឹក", "មួយរសៀល", "មួយយប់", "មួយថ្ងៃ"]; const outDurations = ["មួយព្រឹក", "មួយរសៀល", "មួយថ្ងៃ"]; const outDurationItems = outDurations.map(d => ({ text: d, value: d })); const outReasons = ["ទៅផ្សារ", "ទៅកាត់សក់", "ទៅភ្នំពេញ", "ទៅពេទ្យ", "ទៅយកអីវ៉ាន់"]; const outReasonItems = outReasons.map(r => ({ text: r, value: r })); const durationToDaysMap = { "មួយថ្ងៃកន្លះ": 1.5, "ពីរថ្ងៃ": 2, "ពីរថ្ងៃកន្លះ": 2.5, "បីថ្ងៃ": 3, "បីថ្ងៃកន្លះ": 3.5, "បួនថ្ងៃ": 4, "បួនថ្ងៃកន្លះ": 4.5, "ប្រាំថ្ងៃ": 5, "ប្រាំថ្ងៃកន្លះ": 5.5, "ប្រាំមួយថ្ងៃ": 6, "ប្រាំមួយថ្ងៃកន្លះ": 6.5, "ប្រាំពីរថ្ងៃ": 7 };

// --- Date Helper Functions ---
function getTodayString(format = 'yyyy-mm-dd') { const today = new Date(); const yyyy = today.getFullYear(); const mm = String(today.getMonth() + 1).padStart(2, '0'); const dd = String(today.getDate()).padStart(2, '0'); if (format === 'dd/mm/yyyy') return `${dd}/${mm}/${yyyy}`; return `${yyyy}-${mm}-${dd}`; }
function formatDbDateToInput(dbDate) { if (!dbDate || dbDate.split('/').length !== 3) return getTodayString(); const parts = dbDate.split('/'); return `${parts[2]}-${parts[1]}-${parts[0]}`; }
function formatInputDateToDb(inputDate) { if (!inputDate || inputDate.split('-').length !== 3) return getTodayString('dd/mm/yyyy'); const parts = inputDate.split('-'); return `${parts[2]}/${parts[1]}-${parts[0]}`; }
function addDays(startDateStr, days) { try { const date = new Date(startDateStr); if (isNaN(date.getTime())) return getTodayString(); date.setDate(date.getDate() + Math.ceil(days) - 1); const yyyy = date.getFullYear(); const mm = String(date.getMonth() + 1).padStart(2, '0'); const dd = String(date.getDate()).padStart(2, '0'); return `${yyyy}-${mm}-${dd}`; } catch (e) { console.error("Error in addDays:", e); return getTodayString(); } }
function formatFirestoreTimestamp(timestamp, format = 'HH:mm dd/MM/yyyy') { let date; if (!timestamp) return ""; if (timestamp instanceof Date) date = timestamp; else if (timestamp.toDate) date = timestamp.toDate(); else if (typeof timestamp === 'string') { date = new Date(timestamp); if (isNaN(date.getTime())) return ""; } else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000); else return ""; const hours = String(date.getHours()).padStart(2, '0'); const minutes = String(date.getMinutes()).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); const month = String(date.getMonth() + 1).padStart(2, '0'); const year = date.getFullYear(); if (format === 'HH:mm' || format === 'time') return `${hours}:${minutes}`; if (format === 'dd/MM/yyyy' || format === 'date') return `${day}/${month}/${year}`; return `${hours}:${minutes} ${day}/${month}/${year}`; }
function parseReturnedAt_(returnedAtString) { if (!returnedAtString || typeof returnedAtString !== 'string') return { date: "", time: "" }; const parts = returnedAtString.split(' '); if (parts.length === 2) return { time: parts[0], date: parts[1] }; return { date: returnedAtString, time: "" }; }
function formatDateToDdMmmYyyy(dateString) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let date;
    if (dateString.includes('/') && dateString.split('/').length === 3) { // dd/mm/yyyy
        const parts = dateString.split('/');
        date = new Date(parts[2], parts[1] - 1, parts[0]); // year, month (0-indexed), day
    } else {
        date = new Date(); // Fallback
    }
    if (isNaN(date.getTime())) date = new Date(); // Error handling
    const day = String(date.getDate()).padStart(2, '0');
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`; // ត្រឡប់ជា '31-Oct-2025'
}
function parseDdMmmYyyyToInputFormat(ddMmmYyyy) {
    if (!ddMmmYyyy || ddMmmYyyy.split('-').length !== 3) return getTodayString(); // fallback
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const parts = ddMmmYyyy.split('-'); // [ '31', 'Oct', '2025' ]
    if(parts.length !== 3) return getTodayString();
    const day = parts[0];
    const monthIndex = monthNames.indexOf(parts[1]);
    const year = parts[2];
    if (monthIndex === -1) return getTodayString(); // fallback
    const mm = String(monthIndex + 1).padStart(2, '0');
    return `${year}-${mm}-${day}`; // ត្រឡប់ជា 'yyyy-mm-dd'
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {

    // --- Assign Element References ---
    userSearchInput = document.getElementById('user-search'); userDropdown = document.getElementById('user-dropdown'); userSearchError = document.getElementById('user-search-error'); scanFaceBtn = document.getElementById('scan-face-btn'); modelStatusEl = document.getElementById('model-status'); faceScanModal = document.getElementById('face-scan-modal'); video = document.getElementById('video'); scanStatusEl = document.getElementById('scan-status'); scanDebugEl = document.getElementById('scan-debug'); cancelScanBtn = document.getElementById('cancel-scan-btn'); loginFormContainer = document.getElementById('login-form-container'); inAppWarning = document.getElementById('in-app-warning'); dataLoadingIndicator = document.getElementById('data-loading-indicator'); rememberMeCheckbox = document.getElementById('remember-me'); mainAppContainer = document.getElementById('main-app-container'); homeUserName = document.getElementById('home-user-name'); loginPage = document.getElementById('page-login'); bottomNav = document.getElementById('bottom-navigation'); userPhotoEl = document.getElementById('user-photo'); userNameEl = document.getElementById('user-name'); userIdEl = document.getElementById('user-id'); userGenderEl = document.getElementById('user-gender'); userGroupEl = document.getElementById('user-group'); userDepartmentEl = document.getElementById('user-department'); logoutBtn = document.getElementById('logout-btn'); navButtons = document.querySelectorAll('.nav-btn');
    mainContent = document.getElementById('main-content'); criticalErrorDisplay = document.getElementById('critical-error-display'); requestLeavePage = document.getElementById('page-request-leave'); openLeaveRequestBtn = document.getElementById('open-leave-request-btn'); cancelLeaveRequestBtn = document.getElementById('cancel-leave-request-btn'); submitLeaveRequestBtn = document.getElementById('submit-leave-request-btn'); leaveDurationSearchInput = document.getElementById('leave-duration-search'); leaveDurationDropdownEl = document.getElementById('leave-duration-dropdown'); leaveSingleDateContainer = document.getElementById('leave-single-date-container'); leaveDateRangeContainer = document.getElementById('leave-date-range-container'); leaveSingleDateInput = document.getElementById('leave-date-single'); leaveStartDateInput = document.getElementById('leave-date-start'); leaveEndDateInput = document.getElementById('leave-date-end'); leaveRequestErrorEl = document.getElementById('leave-request-error'); leaveRequestLoadingEl = document.getElementById('leave-request-loading'); leaveReasonSearchInput = document.getElementById('leave-reason-search'); leaveReasonDropdownEl = document.getElementById('leave-reason-dropdown'); historyContainer = document.getElementById('history-container'); historyPlaceholder = document.getElementById('history-placeholder'); historyTabLeave = document.getElementById('history-tab-leave'); historyTabOut = document.getElementById('history-tab-out'); historyContainerLeave = document.getElementById('history-container-leave'); historyContainerOut = document.getElementById('history-container-out'); historyPlaceholderLeave = document.getElementById('history-placeholder-leave'); historyPlaceholderOut = document.getElementById('history-placeholder-out'); historyContent = document.getElementById('history-content'); editModal = document.getElementById('edit-modal'); editModalTitle = document.getElementById('edit-modal-title'); editForm = document.getElementById('edit-form'); editRequestId = document.getElementById('edit-request-id'); editDurationSearch = document.getElementById('edit-duration-search'); editDurationDropdown = document.getElementById('edit-duration-dropdown'); editSingleDateContainer = document.getElementById('edit-single-date-container'); editLeaveDateSingle = document.getElementById('edit-leave-date-single'); editDateRangeContainer = document.getElementById('edit-date-range-container'); editLeaveDateStart = document.getElementById('edit-leave-date-start'); editLeaveDateEnd = document.getElementById('edit-leave-date-end'); editReasonSearch = document.getElementById('edit-reason-search'); editReasonDropdown = document.getElementById('edit-reason-dropdown'); editErrorEl = document.getElementById('edit-error'); editLoadingEl = document.getElementById('edit-loading'); submitEditBtn = document.getElementById('submit-edit-btn'); cancelEditBtn = document.getElementById('cancel-edit-btn'); deleteModal = document.getElementById('delete-modal'); deleteConfirmBtn = document.getElementById('delete-confirm-btn'); cancelDeleteBtn = document.getElementById('cancel-delete-btn'); deleteRequestId = document.getElementById('delete-request-id'); deleteCollectionType = document.getElementById('delete-collection-type'); openOutRequestBtn = document.getElementById('open-out-request-btn'); requestOutPage = document.getElementById('page-request-out'); cancelOutRequestBtn = document.getElementById('cancel-out-request-btn'); submitOutRequestBtn = document.getElementById('submit-out-request-btn'); outRequestErrorEl = document.getElementById('out-request-error'); outRequestLoadingEl = document.getElementById('out-request-loading'); outDurationSearchInput = document.getElementById('out-duration-search'); outDurationDropdownEl = document.getElementById('out-duration-dropdown'); outReasonSearchInput = document.getElementById('out-reason-search'); outReasonDropdownEl = document.getElementById('out-reason-dropdown'); outDateInput = document.getElementById('out-date-single'); returnScanModal = document.getElementById('return-scan-modal'); returnVideo = document.getElementById('return-video'); returnScanStatusEl = document.getElementById('return-scan-status'); returnScanDebugEl = document.getElementById('return-scan-debug'); cancelReturnScanBtn = document.getElementById('cancel-return-scan-btn'); customAlertModal = document.getElementById('custom-alert-modal'); customAlertTitle = document.getElementById('custom-alert-title'); customAlertMessage = document.getElementById('custom-alert-message'); customAlertOkBtn = document.getElementById('custom-alert-ok-btn'); customAlertIconWarning = document.getElementById('custom-alert-icon-warning'); customAlertIconSuccess = document.getElementById('custom-alert-icon-success'); invoiceModal = document.getElementById('invoice-modal'); closeInvoiceModalBtn = document.getElementById('close-invoice-modal-btn'); invoiceModalTitle = document.getElementById('invoice-modal-title'); invoiceContentWrapper = document.getElementById('invoice-content-wrapper'); invoiceContent = document.getElementById('invoice-content'); invoiceUserName = document.getElementById('invoice-user-name'); invoiceUserId = document.getElementById('invoice-user-id'); invoiceUserDept = document.getElementById('invoice-user-dept'); invoiceRequestType = document.getElementById('invoice-request-type'); invoiceDuration = document.getElementById('invoice-duration'); invoiceDates = document.getElementById('invoice-dates'); invoiceReason = document.getElementById('invoice-reason'); invoiceStatus = document.getElementById('invoice-status'); invoiceApprover = document.getElementById('invoice-approver'); invoiceDecisionTime = document.getElementById('invoice-decision-time'); invoiceRequestId = document.getElementById('invoice-request-id'); invoiceReturnInfo = document.getElementById('invoice-return-info'); invoiceReturnStatus = document.getElementById('invoice-return-status'); invoiceReturnTime = document.getElementById('invoice-return-time'); shareInvoiceBtn = document.getElementById('share-invoice-btn'); invoiceShareStatus = document.getElementById('invoice-share-status');
    openDailyAttendanceBtn = document.getElementById('open-daily-attendance-btn');
    attendancePage = document.getElementById('page-daily-attendance');
    closeAttendancePageBtn = document.getElementById('close-attendance-page-btn');
    attendanceIframe = document.getElementById('attendance-iframe');
    pages = ['page-home', 'page-history', 'page-account', 'page-help', 'page-request-leave', 'page-request-out', 'page-daily-attendance'];
    if (customAlertOkBtn) customAlertOkBtn.addEventListener('click', hideCustomAlert);
    if (closeInvoiceModalBtn) closeInvoiceModalBtn.addEventListener('click', hideInvoiceModal);
    if (shareInvoiceBtn) shareInvoiceBtn.addEventListener('click', shareInvoiceAsImage);
    if (historyContent) { historyContent.addEventListener('touchstart', handleTouchStart, false); historyContent.addEventListener('touchmove', handleTouchMove, false); historyContent.addEventListener('touchend', handleTouchEnd, false); }
    function handleHistoryTap(event) { console.log("History container tapped. Target:", event.target); const invoiceBtn = event.target.closest('.invoice-btn'); const returnBtn = event.target.closest('.return-btn'); const editBtn = event.target.closest('.edit-btn'); const deleteBtn = event.target.closest('.delete-btn'); if (invoiceBtn) { console.log("Invoice button tapped directly via touchstart!", invoiceBtn.dataset.id); event.preventDefault(); openInvoiceModal(invoiceBtn.dataset.id, invoiceBtn.dataset.type); } else if (returnBtn) { console.log("Return button tapped directly via touchstart!", returnBtn.dataset.id); event.preventDefault(); startReturnConfirmation(returnBtn.dataset.id); } else if (editBtn) { console.log("Edit button tapped directly via touchstart!", editBtn.dataset.id); event.preventDefault(); openEditModal(editBtn.dataset.id, editBtn.dataset.type); } else if (deleteBtn) { console.log("Delete button tapped directly via touchstart!", deleteBtn.dataset.id); event.preventDefault(); openDeleteModal(deleteBtn.dataset.id, deleteBtn.dataset.type); } }
    if (historyContainerLeave) historyContainerLeave.addEventListener('touchstart', handleHistoryTap, { passive: false });
    if (historyContainerOut) historyContainerOut.addEventListener('touchstart', handleHistoryTap, { passive: false });

    // --- Setup Dropdowns AFTER elements are available ---
    
    // ========== START: CRITICAL FIX 1 ==========
    setupSearchableDropdown('user-search', 'user-dropdown', [], (id) => { // Initially empty, populated by fetchUsers
        selectedUserId = id;
        
        // --- CRITICAL FIX ---
        // លុប "កូនសោគោល" ចាស់ចោល រាល់ពេលជ្រើសរើស User ថ្មី
        userReferenceDescriptor = null; 
        console.log("Reference Descriptor Cleared on User Select.");
        // --- END CRITICAL FIX ---

        if (scanFaceBtn) scanFaceBtn.disabled = (id === null || !modelStatusEl || modelStatusEl.textContent !== 'Model ស្កេនមុខបានទាញយករួចរាល់');
        console.log("Selected User ID:", selectedUserId);
    });
    // ========== END: CRITICAL FIX 1 ==========

    setupSearchableDropdown('leave-duration-search', 'leave-duration-dropdown', leaveDurationItems, (duration) => { selectedLeaveDuration = duration; updateLeaveDateFields(duration); }, false);
    setupSearchableDropdown('leave-reason-search', 'leave-reason-dropdown', leaveReasonItems, (reason) => { selectedLeaveReason = reason; }, true);
    setupSearchableDropdown('out-duration-search', 'out-duration-dropdown', outDurationItems, (duration) => { selectedOutDuration = duration; }, false);
    setupSearchableDropdown('out-reason-search', 'out-reason-dropdown', outReasonItems, (reason) => { selectedOutReason = reason; }, true);
    setupSearchableDropdown('edit-duration-search', 'edit-duration-dropdown', [], () => {}, false);
    setupSearchableDropdown('edit-reason-search', 'edit-reason-dropdown', [], () => {}, true);

    // --- Firebase Initialization & Auth ---
    try { if (!firebaseConfig.projectId) throw new Error("projectId not provided in firebase.initializeApp."); console.log("Initializing Firebase with Config:", firebaseConfig); const app = initializeApp(firebaseConfig); db = getFirestore(app); auth = getAuth(app); const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; leaveRequestsCollectionPath = `/artifacts/${canvasAppId}/public/data/leave_requests`; outRequestsCollectionPath = `/artifacts/${canvasAppId}/public/data/out_requests`; console.log("Using Firestore Leave Path:", leaveRequestsCollectionPath); console.log("Using Firestore Out Path:", outRequestsCollectionPath); onAuthStateChanged(auth, (user) => { if (user) { console.log("Firebase Auth state changed. User UID:", user.uid); userId = user.uid; function isClient() { const ua = navigator.userAgent || navigator.vendor || window.opera; return ( (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || (ua.indexOf('Twitter') > -1) || (ua.indexOf('Telegram') > -1) || (ua.indexOf('WebView') > -1) || (ua.indexOf('wv') > -1) ); } if (isClient()) { console.log("Detected In-App Browser."); if (inAppWarning) inAppWarning.classList.remove('hidden'); if (modelStatusEl) modelStatusEl.textContent = 'សូមបើកក្នុង Browser ពេញលេញ'; if (dataLoadingIndicator) dataLoadingIndicator.classList.add('hidden'); } else { console.log("Detected Full Browser."); if (inAppWarning) inAppWarning.classList.add('hidden'); if (typeof faceapi !== 'undefined') { if (scanFaceBtn) scanFaceBtn.disabled = true; loadFaceApiModels(); } else { console.error("Face-API.js មិនអាចទាញយកបានត្រឹមត្រូវទេ។"); if (modelStatusEl) modelStatusEl.textContent = 'Error: មិនអាចទាញយក Library ស្កេនមុខបាន'; } const rememberedUser = localStorage.getItem('leaveAppUser'); if (rememberedUser) { try { const parsedUser = JSON.parse(rememberedUser); if (parsedUser && parsedUser.id) { console.log("Found remembered user:", parsedUser.id); currentUser = parsedUser; showLoggedInState(parsedUser); fetchUsers(); return; } } catch (e) { localStorage.removeItem('leaveAppUser'); } } console.log("No remembered user found, starting normal app flow."); initializeAppFlow(); } } else { console.log("Firebase Auth: No user signed in. Attempting anonymous sign-in..."); signInAnonymously(auth).catch(anonError => { console.error("Error during automatic anonymous sign-in attempt:", anonError); if (criticalErrorDisplay) { criticalErrorDisplay.classList.remove('hidden'); criticalErrorDisplay.textContent = `Critical Error: មិនអាច Sign In បានទេ។ ${anonError.message}។ សូម Refresh ម្ដងទៀត។`; } }); } }); try { console.log("Attempting initial Anonymous Sign-In..."); await signInAnonymously(auth); console.log("Firebase Auth: Initial Anonymous Sign-In successful (or already signed in)."); } catch (e) { console.error("Initial Anonymous Sign-In Error:", e); if (e.code === 'auth/operation-not-allowed') { throw new Error("សូមបើក 'Anonymous' sign-in នៅក្នុង Firebase Console។"); } throw new Error(`Firebase Sign-In Error: ${e.message}`); } } catch (e) { console.error("Firebase Initialization/Auth Error:", e); if(criticalErrorDisplay) { criticalErrorDisplay.classList.remove('hidden'); criticalErrorDisplay.textContent = `Critical Error: មិនអាចតភ្ជាប់ Firebase បានទេ។ ${e.message}។ សូម Refresh ម្ដងទៀត។`; } if(loginPage) loginPage.classList.add('hidden'); }

    // --- Main App Logic ---
    function initializeAppFlow() { console.log("initializeAppFlow called (for non-remembered user)."); console.log("Fetching users for initial login..."); if (dataLoadingIndicator) dataLoadingIndicator.classList.remove('hidden'); fetchUsers(); }
    async function fetchUsers() { console.log("Fetching users from Google Sheet..."); try { const response = await fetch(GVIZ_URL); if (!response.ok) throw new Error(`Google Sheet fetch failed: ${response.status}`); const text = await response.text(); const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s); if (!match || !match[1]) throw new Error("ទម្រង់ការឆ្លើយតបពី Google Sheet មិនត្រឹមត្រូវ"); const json = JSON.parse(match[1]); if (json.table && json.table.rows && json.table.rows.length > 0) { allUsersData = json.table.rows.map(row => ({ id: row.c?.[0]?.v ?? null, name: row.c?.[1]?.v ?? null, photo: row.c?.[2]?.v ?? null, gender: row.c?.[3]?.v ?? null, group: row.c?.[4]?.v ?? null, department: row.c?.[5]?.v ?? null })); console.log(`Fetched ${allUsersData.length} users.`);
    populateUserDropdown(allUsersData, 'user-search', 'user-dropdown', (id) => { 
        selectedUserId = id; 
        userReferenceDescriptor = null; // CRITICAL FIX
        console.log("Reference Descriptor Cleared on populateUserDropdown.");
        if (scanFaceBtn) scanFaceBtn.disabled = (id === null || !modelStatusEl || modelStatusEl.textContent !== 'Model ស្កេនមុខបានទាញយករួចរាល់'); 
        console.log("Selected User ID:", selectedUserId); 
    });
        if (dataLoadingIndicator) dataLoadingIndicator.classList.add('hidden'); if (loginFormContainer) loginFormContainer.classList.remove('hidden'); } else { throw new Error("រកមិនឃើញទិន្នន័យអ្នកប្រើប្រាស់"); } } catch (error) { console.error("Error ពេលទាញយកទិន្នន័យ Google Sheet:", error); if (dataLoadingIndicator) { dataLoadingIndicator.innerHTML = `<p class="text-red-600 font-semibold">Error: មិនអាចទាញយកទិន្នន័យបាន</p><p class="text-gray-600 text-sm mt-1">សូមពិនិត្យអ៊ីនធឺណិត និង Refresh ម្ដងទៀត។</p>`; dataLoadingIndicator.classList.remove('hidden'); } } }

    // --- Reusable Searchable Dropdown Logic ---
    function setupSearchableDropdown(inputId, dropdownId, items, onSelectCallback, allowCustom = false) { const searchInput = document.getElementById(inputId); const dropdown = document.getElementById(dropdownId); if (!searchInput || !dropdown) { console.error(`Dropdown elements not found: inputId=${inputId}, dropdownId=${dropdownId}`); return; } function populateDropdown(filter = '') { dropdown.innerHTML = ''; const filteredItems = items.filter(item => item.text && item.text.toLowerCase().includes(filter.toLowerCase())); if (filteredItems.length === 0 && !allowCustom && inputId !== 'user-search') { /* Allow user dropdown to be empty */ dropdown.classList.add('hidden'); return; } filteredItems.forEach(item => { const itemEl = document.createElement('div'); itemEl.textContent = item.text; itemEl.dataset.value = item.value; itemEl.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm'; itemEl.addEventListener('mousedown', (e) => { e.preventDefault(); searchInput.value = item.text; dropdown.classList.add('hidden'); if (onSelectCallback) onSelectCallback(item.value); console.log(`Selected dropdown item: ${item.text} (value: ${item.value})`); }); dropdown.appendChild(itemEl); }); dropdown.classList.remove('hidden'); } searchInput.addEventListener('input', () => { const currentValue = searchInput.value; populateDropdown(currentValue); const exactMatch = items.find(item => item.text === currentValue); const selection = exactMatch ? exactMatch.value : (allowCustom ? currentValue : null); if (onSelectCallback) onSelectCallback(selection); }); searchInput.addEventListener('focus', () => { populateDropdown(searchInput.value); }); searchInput.addEventListener('blur', () => { setTimeout(() => { dropdown.classList.add('hidden'); const currentValue = searchInput.value; const validItem = items.find(item => item.text === currentValue); if (validItem) { if (onSelectCallback) onSelectCallback(validItem.value); } else if (allowCustom && currentValue.trim() !== '') { if (onSelectCallback) onSelectCallback(currentValue); } else if (inputId !== 'user-search') { /* Don't clear user search on blur */ console.log(`Invalid selection on ${inputId}: ${currentValue}`); if (onSelectCallback) onSelectCallback(null); } }, 150); }); }
    function populateUserDropdown(users, inputId, dropdownId, onSelectCallback) { const userItems = users.filter(user => user.id && user.name).map(user => ({ text: `${user.id} - ${user.name}`, value: user.id })); setupSearchableDropdown(inputId, dropdownId, userItems, onSelectCallback, false); }

    // --- Face Scan Logic ---

    // ========== START: MODIFICATION (Smarter Model) ==========
    async function loadFaceApiModels() { 
        if (!modelStatusEl) return; 
        try { 
            console.log("Loading face-api models (SsdMobilenetv1)..."); 
            modelStatusEl.textContent = 'កំពុងទាញយក Model ស្កេនមុខ...'; 
            await Promise.all([ 
                // --- ប្តូរទៅប្រើ Model ឆ្លាតជាងមុន ---
                faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
                // --- Model ទាំងពីរនេះ នៅដដែល ---
                faceapi.nets.faceLandmark68TinyNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'), 
                faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'), 
            ]); 
            modelStatusEl.textContent = 'Model ស្កេនមុខបានទាញយករួចរាល់'; 
            console.log("Face-api models loaded successfully (SsdMobilenetv1)."); 
            if (scanFaceBtn) scanFaceBtn.disabled = (selectedUserId === null); 
        } catch (error) { 
            console.error("Error ពេលទាញយក Model របស់ face-api:", error); 
            modelStatusEl.textContent = 'Error: មិនអាចទាញយក Model បាន'; 
        } 
    }
    // ========== END: MODIFICATION (Smarter Model) ==========

    // ========== START: MODIFICATION (Better Master Key) ==========
    async function getReferenceDescriptor(userPhotoUrl) { 
        if (userReferenceDescriptor) { 
            console.log("Using cached reference descriptor."); 
            return userReferenceDescriptor; 
        } 
        if (!userPhotoUrl) throw new Error("Missing user photo URL"); 
        console.log("Fetching and computing new reference descriptor (SsdMobilenetv1)..."); 
        let referenceImage; 
        try { 
            const img = new Image(); 
            img.crossOrigin = 'anonymous'; 
            img.src = userPhotoUrl; 
            await new Promise((resolve, reject) => { 
                img.onload = () => resolve(); 
                img.onerror = (err) => reject(new Error('Failed to fetch (មិនអាចទាញយករូបថតយោងបាន)។ សូមប្រាកដថា Link រូបថតត្រឹមត្រូវ។')); 
            }); 
            referenceImage = img; 
        } catch (fetchError) { 
            throw fetchError; 
        } 
        
        let referenceDetection; 
        try { 
            // --- ប្តូរទៅប្រើ Model ឆ្លាតជាងមុន ដើម្បីបង្កើត "កូនសោគោល" ---
            const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
            referenceDetection = await faceapi.detectSingleFace(referenceImage, options)
                                        .withFaceLandmarks(true)
                                        .withFaceDescriptor(); 
            if (!referenceDetection) throw new Error('រកមិនឃើញមុខនៅក្នុងរូបថតយោង'); 
        } catch (descriptorError) { 
            console.error("Descriptor Error:", descriptorError); 
            throw new Error('មិនអាចវិភាគមុខពីរូបថតយោងបានទេ (រូបថតអាចមិនច្បាស់)។'); 
        } 
        userReferenceDescriptor = referenceDetection.descriptor; 
        return userReferenceDescriptor; 
    }
    // ========== END: MODIFICATION (Better Master Key) ==========


// ========== START: NEW ADVANCED FACE ANALYSIS (rAF) ==========

/**
 * បញ្ឈប់ Loop វិភាគផ្ទៃមុខ
 */
function stopAdvancedFaceAnalysis() {
    console.log("Stopping Advanced Face Analysis...");
    isFaceAnalysisRunning = false;
}

/**
 * ចាប់ផ្តើមការវិភាគផ្ទៃមុខកម្រិតខ្ពស់ ដោយប្រើ requestAnimationFrame
 * @param {HTMLVideoElement} videoElement - ធាតុ <video>
 * @param {HTMLElement} statusElement - ធាតុ <p> សម្រាប់បង្ហាញសារ
 * @param {HTMLElement} debugElement - ធាតុ <p> សម្រាប់បង្ហាញ debug
 * @param {faceapi.L2EuclideanDistance} referenceDescriptor - "កូនសោគោល" សម្រាប់ប្រៀបធៀប
 * @param {Function} onSuccessCallback - Function ដែលត្រូវហៅ (call) នៅពេលផ្ទៀងផ្ទាត់ជោគជ័យ
 */
function startAdvancedFaceAnalysis(videoElement, statusElement, debugElement, referenceDescriptor, onSuccessCallback) {
    console.log("Starting Advanced Face Analysis (rAF)...");
    isFaceAnalysisRunning = true;
    lastFaceCheck = 0; // Reset ម៉ោងពិនិត្យចុងក្រោយ

    // --- កំណត់ "ច្បាប់" សម្រាប់ផ្ទៃមុខ ---
    const VERIFICATION_THRESHOLD = 0.5; // តឹងរ៉ឹងជាងមុន (0.5 ជំនួស 0.55)
    const MIN_WIDTH_PERCENT = 0.3;     // មុខត្រូវមានទំហំយ៉ាងតិច 30% នៃវីដេអូ
    const MAX_WIDTH_PERCENT = 0.7;     // មុខត្រូវមានទំហំយ៉ាងច្រើន 70%
    const CENTER_TOLERANCE_PERCENT = 0.2; // ទីតាំងកណ្តាល អាច lệch បាន 20%

    // គណនាទំហំជា pixels (គណនាម្តងបានហើយ)
    const videoWidth = videoElement.clientWidth || 320; // Fallback ក្នុងករណី video មិនទាន់មានទំហំ
    const videoCenterX = videoWidth / 2;
    const minPixelWidth = videoWidth * MIN_WIDTH_PERCENT;
    const maxPixelWidth = videoWidth * MAX_WIDTH_PERCENT;
    const centerTolerancePixels = videoWidth * CENTER_TOLERANCE_PERCENT;
    
    console.log(`Analysis Rules: Threshold=<${VERIFICATION_THRESHOLD}, minWidth=${minPixelWidth}px, maxWidth=${maxPixelWidth}px`);

    // --- បង្កើត Loop ថ្មី ដោយប្រើ requestAnimationFrame ---
    async function analysisLoop(timestamp) {
        if (!isFaceAnalysisRunning) return; // បញ្ឈប់ Loop

        // --- Throttling Logic (ធ្វើឲ្យលឿន តែមិនគាំង) ---
        // ពិនិត្យថា តើដល់ពេលត្រូវវិភាគឬនៅ (រៀងរាល់ 500ms)
        if (timestamp - lastFaceCheck < FACE_CHECK_INTERVAL) {
            requestAnimationFrame(analysisLoop); // បន្ត Loop ទៅ Frame បន្ទាប់ តែមិនវិភាគ
            return; // រំលងការវិភាគ
        }
        lastFaceCheck = timestamp;
        // --- End Throttling ---

        try {
            if (!videoElement || videoElement.readyState < 3) {
                requestAnimationFrame(analysisLoop); // បន្ត Loop រង់ចាំវីដេអូ
                return; 
            }

            // ========== START: MODIFICATION (Smarter Model) ==========
            // --- ប្តូរទៅប្រើ Model ឆ្លាតជាងមុន សម្រាប់ការវិភាគផ្ទាល់ ---
            const detections = await faceapi.detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                                        .withFaceLandmarks(true)
                                        .withFaceDescriptor();
            // ========== END: MODIFICATION (Smarter Model) ==========


            // ពិនិត្យទី១៖ តើមានមុខឬអត់?
            if (!detections) {
                statusElement.textContent = 'រកមិនឃើញផ្ទៃមុខ...';
                debugElement.textContent = '';
            } else {
                const box = detections.detection.box;
                const faceCenterX = box.x + box.width / 2;
                
                // ពិនិត្យទី២៖ តើមុខនៅឆ្ងាយពេក (តូចពេក)?
                if (box.width < minPixelWidth) {
                    statusElement.textContent = 'សូមរំកលមុខមកជិតបន្តិច';
                    debugElement.textContent = `ទំហំ: ${Math.round(box.width)}px (តូចពេក)`;
                } 
                // ពិនិត្យទី៣៖ តើមុខនៅជិតពេក (ធំពេក)?
                else if (box.width > maxPixelWidth) {
                    statusElement.textContent = 'សូមរំកលមុខថយក្រោយបន្តិច';
                    debugElement.textContent = `ទំហំ: ${Math.round(box.width)}px (ធំពេក)`;
                } 
                // ពិនិត្យទី៤៖ តើមុខនៅចំកណ្តាល?
                else if (Math.abs(faceCenterX - videoCenterX) > centerTolerancePixels) {
                    statusElement.textContent = 'សូមដាក់មុខនៅចំកណ្តាល';
                    const distanceToCenter = Math.abs(faceCenterX - videoCenterX);
                    debugElement.textContent = ` lệch: ${Math.round(distanceToCenter)}px`;
                } 
                // --- ឆ្លងកាត់គ្រប់លក្ខខណ្ឌ! ចាប់ផ្តើមផ្ទៀងផ្ទាត់ ---
                else {
                    statusElement.textContent = 'រកឃើញ! កំពុងផ្ទៀងផ្ទាត់...';
                    const distance = faceapi.euclideanDistance(referenceDescriptor, detections.descriptor);
                    
                    // បង្ហាញ "ចំងាយ" (distance)
                    debugElement.textContent = `ចំងាយ: ${distance.toFixed(2)} (ត្រូវតែ < ${VERIFICATION_THRESHOLD})`;

                    // ពិនិត្យទី៥៖ តើមុខត្រឹមត្រូវ (ចំងាយ < 0.5)?
                    if (distance < VERIFICATION_THRESHOLD) {
                        statusElement.textContent = 'ផ្ទៀងផ្ទាត់ជោគជ័យ!';
                        isFaceAnalysisRunning = false; // បញ្ឈប់ Loop
                        onSuccessCallback(); // ហៅ Function ជោគជ័យ
                        return; // --- ចេញពី Loop ---
                    } else {
                        statusElement.textContent = 'មុខមិនត្រឹមត្រូវ... សូមព្យាយាមម្តងទៀត';
                    }
                }
            }
        
        } catch (error) {
            console.error("Error during face analysis rAF loop:", error);
            statusElement.textContent = 'មានបញ្ហាពេលវិភាគ...';
        }
        
        // បន្ត Loop ទៅ Frame បន្ទាប់
        requestAnimationFrame(analysisLoop);
    }

    // --- ចាប់ផ្តើម Loop ---
    requestAnimationFrame(analysisLoop);
}

// ========== END: NEW ADVANCED FACE ANALYSIS (rAF) ==========


// ========== START: MODIFIED scan/stop functions ==========

async function startFaceScan() { 
    console.log("startFaceScan called."); 
    if (!selectedUserId) { 
        showCustomAlert("Error", "សូមជ្រើសរើសអត្តលេខរបស់អ្នកជាមុនសិន"); 
        return; 
    } 
    const user = allUsersData.find(u => u.id === selectedUserId); 
    if (!user || !user.photo) { 
        showCustomAlert("Error", "មិនអាចទាញយករូបថតយោងរបស់អ្នកបានទេ។ សូមទាក់ទង IT Support។"); 
        return; 
    } 
    if (faceScanModal) faceScanModal.classList.remove('hidden'); 
    if (scanStatusEl) scanStatusEl.textContent = 'កំពុងព្យាយាមបើកកាមេរ៉ា...'; 
    
    try { 
        if (scanStatusEl) scanStatusEl.textContent = 'កំពុងវិភាគរូបថតយោង...'; 
        const referenceDescriptor = await getReferenceDescriptor(user.photo); 
        if (scanStatusEl) scanStatusEl.textContent = 'កំពុងស្នើសុំបើកកាមេរ៉ា...'; 
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} }); 

        // --- START: MODIFIED BLOCK (rAF) ---
        if (video) video.srcObject = stream; 
        if (scanStatusEl) scanStatusEl.textContent = 'សូមដាក់មុខរបស់អ្នកឲ្យចំកាមេរ៉ា'; 
        
        stopAdvancedFaceAnalysis(); // បញ្ឈប់ Loop ចាស់ (ប្រសិនបើមាន)

        // កំណត់អ្វីដែលត្រូវធ្វើនៅពេលជោគជ័យ
        const onSuccess = () => {
            console.log("Login Scan Success!");
            // Loop ឈប់ដោយខ្លួនឯង តែយើងត្រូវបិទវីដេអូ
            if (video && video.srcObject) { 
                video.srcObject.getTracks().forEach(track => track.stop()); 
                video.srcObject = null; 
            }
            loginUser(selectedUserId); // ដំណើរការ Login
            setTimeout(() => {
                if (faceScanModal) faceScanModal.classList.add('hidden');
            }, 1000);
        };

        // ហៅ Function វិភាគថ្មី
        startAdvancedFaceAnalysis(
            video, 
            scanStatusEl, 
            scanDebugEl, 
            referenceDescriptor, 
            onSuccess
        );
        // --- END: MODIFIED BLOCK (rAF) ---
 
    } catch (error) { 
        console.error("Error during face scan process:", error); 
        if (scanStatusEl) scanStatusEl.textContent = `Error: ${error.message}`; 
        stopFaceScan(); // ហៅ stopFaceScan ពេលមានបញ្ហា
        setTimeout(() => { 
            if (faceScanModal) faceScanModal.classList.add('hidden'); 
            showCustomAlert("បញ្ហាស្កេនមុខ", `មានបញ្ហា៖\n${error.message}\nសូមប្រាកដថាអ្នកបានអនុញ្ញាតឲ្យប្រើកាមេរ៉ា។`); 
        }, 1500); 
    } 
}

/**
 * មុខងារថ្មីសម្រាប់ stopFaceScan (ប្រើ rAF)
 */
function stopFaceScan() { 
    stopAdvancedFaceAnalysis(); // បញ្ឈប់ Loop rAF
    if (video && video.srcObject) { 
        video.srcObject.getTracks().forEach(track => track.stop()); 
        video.srcObject = null; 
    } 
}

// ========== START: CRITICAL FIX 2 ==========
if (scanFaceBtn) scanFaceBtn.addEventListener('click', startFaceScan);
if (cancelScanBtn) cancelScanBtn.addEventListener('click', () => { 
    stopFaceScan(); 
    
    // --- CRITICAL FIX ---
    // លុប "កូនសោគោល" ចោល នៅពេលបោះបង់
    userReferenceDescriptor = null;
    console.log("Reference Descriptor Cleared on Cancel.");
    // --- END CRITICAL FIX ---

    if (faceScanModal) faceScanModal.classList.add('hidden'); 
});
// ========== END: CRITICAL FIX 2 ==========

// ========== END: MODIFIED scan/stop functions ==========


    // --- App Navigation & State Logic ---
    function loginUser(userIdToLogin) { const user = allUsersData.find(u => u.id === userIdToLogin); if (!user) { showCustomAlert("Login Error", "មានបញ្ហា Login: រកមិនឃើញទិន្នន័យអ្នកប្រើប្រាស់"); return; } if (rememberMeCheckbox && rememberMeCheckbox.checked) { localStorage.setItem('leaveAppUser', JSON.stringify(user)); } else { localStorage.removeItem('leaveAppUser'); } showLoggedInState(user); }
    function logout() { currentUser = null; userReferenceDescriptor = null; localStorage.removeItem('leaveAppUser'); if (loginPage) loginPage.classList.remove('hidden'); if (mainAppContainer) mainAppContainer.classList.add('hidden'); if (userPhotoEl) userPhotoEl.src = 'https://placehold.co/100x100/e2e8f0/64748b?text=User'; if (userNameEl) userNameEl.textContent = '...'; if (userIdEl) userIdEl.textContent = '...'; if (userSearchInput) userSearchInput.value = ''; selectedUserId = null; if (scanFaceBtn) scanFaceBtn.disabled = true; if (historyUnsubscribe) historyUnsubscribe(); if (outHistoryUnsubscribe) outHistoryUnsubscribe(); historyUnsubscribe = null; outHistoryUnsubscribe = null; signInAnonymously(auth).catch(err => console.error("Error signing in anonymously after logout:", err)); }
    function showLoggedInState(user) { currentUser = user; userReferenceDescriptor = null; populateAccountPage(user); if (homeUserName) homeUserName.textContent = user.name || '...'; if (loginPage) loginPage.classList.add('hidden'); if (mainAppContainer) mainAppContainer.classList.remove('hidden'); if (criticalErrorDisplay) criticalErrorDisplay.classList.add('hidden'); navigateTo('page-home'); setupHistoryListeners(user.id); }
    function populateAccountPage(user) { if (!user) return; if (userPhotoEl && user.photo) { const img = new Image(); img.crossOrigin = "anonymous"; img.src = user.photo; img.onload = () => userPhotoEl.src = img.src; img.onerror = () => userPhotoEl.src = 'https://placehold.co/100x100/e2e8f0/64748b?text=គ្មានរូប'; } else if (userPhotoEl) { userPhotoEl.src = 'https://placehold.co/100x100/e2e8f0/64748b?text=User'; } if (userNameEl) userNameEl.textContent = user.name || 'មិនមាន'; if (userIdEl) userIdEl.textContent = user.id || 'មិនមាន'; if (userGenderEl) userGenderEl.textContent = user.gender || 'មិនមាន'; if (userGroupEl) userGroupEl.textContent = user.group || 'មិនមាន'; if (userDepartmentEl) userDepartmentEl.textContent = user.department || 'មិនមាន'; }
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    function navigateTo(pageId) { console.log("Navigating to page:", pageId); pages.forEach(page => { const pageEl = document.getElementById(page); if (pageEl) pageEl.classList.add('hidden'); }); const targetPage = document.getElementById(pageId); if (targetPage) targetPage.classList.remove('hidden'); 
            if (bottomNav) {
                if (pageId === 'page-request-leave' || pageId === 'page-request-out' || pageId === 'page-daily-attendance') {
                    bottomNav.classList.add('hidden');
                } else {
                    bottomNav.classList.remove('hidden');
                }
            }
            if (navButtons) { navButtons.forEach(btn => { if (btn.dataset.page === pageId) { btn.classList.add('text-blue-600'); btn.classList.remove('text-gray-500'); } else { btn.classList.add('text-gray-500'); btn.classList.remove('text-blue-600'); } }); } if (mainContent) mainContent.scrollTop = 0; if (pageId === 'page-history') showHistoryTab('leave'); }
    if (navButtons) { navButtons.forEach(button => { button.addEventListener('click', () => { const pageToNavigate = button.dataset.page; if (pageToNavigate) navigateTo(pageToNavigate); }); }); }

    // --- History Page Tabs & Swipe ---
    let currentHistoryTab = 'leave';
    function showHistoryTab(tabName, fromSwipe = false) { if (tabName === currentHistoryTab && !fromSwipe) return; console.log(`Switching history tab to: ${tabName}`); currentHistoryTab = tabName; if (tabName === 'leave') { if (historyTabLeave) historyTabLeave.classList.add('border-blue-600', 'text-blue-600'); if (historyTabLeave) historyTabLeave.classList.remove('border-transparent', 'text-gray-500'); if (historyTabOut) historyTabOut.classList.add('border-transparent', 'text-gray-500'); if (historyTabOut) historyTabOut.classList.remove('border-blue-600', 'text-blue-600'); if (historyContainerLeave) historyContainerLeave.classList.remove('hidden'); if (historyContainerOut) historyContainerOut.classList.add('hidden'); } else { if (historyTabLeave) historyTabLeave.classList.remove('border-blue-600', 'text-blue-600'); if (historyTabLeave) historyTabLeave.classList.add('border-transparent', 'text-gray-500'); if (historyTabOut) historyTabOut.classList.add('border-blue-600', 'text-blue-600'); if (historyTabOut) historyTabOut.classList.remove('border-transparent', 'text-gray-500'); if (historyContainerLeave) historyContainerLeave.classList.add('hidden'); if (historyContainerOut) historyContainerOut.classList.remove('hidden'); } if (historyContent) historyContent.scrollTop = 0; }
    if (historyTabLeave) historyTabLeave.addEventListener('click', () => showHistoryTab('leave'));
    if (historyTabOut) historyTabOut.addEventListener('click', () => showHistoryTab('out'));
    function handleTouchStart(evt) { const firstTouch = evt.touches[0]; touchstartX = firstTouch.clientX; isSwiping = true; }
    function handleTouchMove(evt) { if (!isSwiping) return; const touch = evt.touches[0]; touchendX = touch.clientX; }
    function handleTouchEnd(evt) { if (!isSwiping) return; isSwiping = false; const threshold = 50; const swipedDistance = touchendX - touchstartX; if (Math.abs(swipedDistance) > threshold) { if (swipedDistance < 0) { console.log("Swiped Left"); showHistoryTab('out', true); } else { console.log("Swiped Right"); showHistoryTab('leave', true); } } else { console.log("Swipe distance too short or vertical scroll."); } touchstartX = 0; touchendX = 0; }

    // --- Leave Request Logic ---
    function updateLeaveDateFields(duration) { const today = getTodayString(); const todayFormatted = getTodayString('dd/mm/yyyy'); if (!leaveSingleDateContainer || !leaveDateRangeContainer || !leaveSingleDateInput || !leaveStartDateInput || !leaveEndDateInput) { console.error("Date input elements not found for Leave form."); return; } if (!duration) { leaveSingleDateContainer.classList.add('hidden'); leaveDateRangeContainer.classList.add('hidden'); return; } if (singleDayLeaveDurations.includes(duration)) { leaveSingleDateContainer.classList.remove('hidden'); leaveDateRangeContainer.classList.add('hidden'); leaveSingleDateInput.value = todayFormatted; } else { leaveSingleDateContainer.classList.add('hidden'); leaveDateRangeContainer.classList.remove('hidden'); leaveStartDateInput.value = today; const days = durationToDaysMap[duration] ?? 1; const endDateValue = addDays(today, days); leaveEndDateInput.value = endDateValue; leaveEndDateInput.min = today; } }
    if (openLeaveRequestBtn) openLeaveRequestBtn.addEventListener('click', () => { if (!currentUser) return showCustomAlert("Error", "សូម Login ជាមុនសិន។"); const reqPhoto = document.getElementById('request-leave-user-photo'); const reqName = document.getElementById('request-leave-user-name'); const reqId = document.getElementById('request-leave-user-id'); const reqDept = document.getElementById('request-leave-user-department'); if(reqPhoto) reqPhoto.src = currentUser.photo || 'https://placehold.co/60x60/e2e8f0/64748b?text=User'; if(reqName) reqName.textContent = currentUser.name; if(reqId) reqId.textContent = currentUser.id; if(reqDept) reqDept.textContent = currentUser.department || 'មិនមាន'; if (leaveDurationSearchInput) leaveDurationSearchInput.value = ''; if (leaveReasonSearchInput) leaveReasonSearchInput.value = ''; selectedLeaveDuration = null; selectedLeaveReason = null; if (leaveSingleDateContainer) leaveSingleDateContainer.classList.add('hidden'); if (leaveDateRangeContainer) leaveDateRangeContainer.classList.add('hidden'); if (leaveRequestErrorEl) leaveRequestErrorEl.classList.add('hidden'); if (leaveRequestLoadingEl) leaveRequestLoadingEl.classList.add('hidden'); if (submitLeaveRequestBtn) submitLeaveRequestBtn.disabled = false; navigateTo('page-request-leave'); });
    if (cancelLeaveRequestBtn) cancelLeaveRequestBtn.addEventListener('click', () => navigateTo('page-home'));
    if (submitLeaveRequestBtn) submitLeaveRequestBtn.addEventListener('click', async () => { selectedLeaveDuration = leaveDurations.includes(leaveDurationSearchInput.value) ? leaveDurationSearchInput.value : null; selectedLeaveReason = leaveReasonSearchInput.value; if (!currentUser || !currentUser.id) return showCustomAlert("Error", "មានបញ្ហា៖ មិនអាចបញ្ជាក់អ្នកប្រើប្រាស់បានទេ។"); if (!selectedLeaveDuration) { if (leaveRequestErrorEl) { leaveRequestErrorEl.textContent = 'សូមជ្រើសរើស "រយៈពេល" ឲ្យបានត្រឹមត្រូវ (ពីក្នុងបញ្ជី)។'; leaveRequestErrorEl.classList.remove('hidden'); } return; } if (!selectedLeaveReason || selectedLeaveReason.trim() === '') { if (leaveRequestErrorEl) { leaveRequestErrorEl.textContent = 'សូមបំពេញ "មូលហេតុ" ជាមុនសិន។'; leaveRequestErrorEl.classList.remove('hidden'); } return; } if (leaveRequestErrorEl) leaveRequestErrorEl.classList.add('hidden'); if (leaveRequestLoadingEl) leaveRequestLoadingEl.classList.remove('hidden'); if (submitLeaveRequestBtn) submitLeaveRequestBtn.disabled = true; try { const isSingleDay = singleDayLeaveDurations.includes(selectedLeaveDuration); const startDateInputVal = isSingleDay ? (leaveSingleDateInput ? leaveSingleDateInput.value : getTodayString('dd/mm/yyyy')) : (leaveStartDateInput ? formatInputDateToDb(leaveStartDateInput.value) : getTodayString('dd/mm/yyyy')); const endDateInputVal = isSingleDay ? startDateInputVal : (leaveEndDateInput ? formatInputDateToDb(leaveEndDateInput.value) : getTodayString('dd/mm/yyyy')); if (new Date(formatDbDateToInput(endDateInputVal)) < new Date(formatDbDateToInput(startDateInputVal))) { throw new Error('"ថ្ងៃបញ្ចប់" មិនអាចនៅមុន "ថ្ងៃចាប់ផ្តើម" បានទេ។'); } const requestId = `leave_${Date.now()}`; const requestData = { userId: currentUser.id, name: currentUser.name, department: currentUser.department || 'N/A', photo: currentUser.photo || null, duration: selectedLeaveDuration, reason: selectedLeaveReason.trim(), startDate: formatDateToDdMmmYyyy(startDateInputVal), endDate: formatDateToDdMmmYyyy(endDateInputVal), status: 'pending', requestedAt: serverTimestamp(), requestId: requestId, firestoreUserId: auth.currentUser ? auth.currentUser.uid : 'unknown_auth_user' }; if (!db || !leaveRequestsCollectionPath) throw new Error("Firestore DB or Collection Path is not initialized."); const requestRef = doc(db, leaveRequestsCollectionPath, requestId); await setDoc(requestRef, requestData); console.log("Firestore (leave) write successful."); const dateString = (startDateInputVal === endDateInputVal) ? startDateInputVal : `ពី ${startDateInputVal} ដល់ ${endDateInputVal}`; let message = `<b>🔔 សំណើសុំច្បាប់ឈប់សម្រាក 🔔</b>\n\n`; message += `<b>ឈ្មោះ:</b> ${requestData.name} (${requestData.userId})\n`; message += `<b>ផ្នែក:</b> ${requestData.department}\n`; message += `<b>រយៈពេល:</b> ${requestData.duration}\n`; message += `<b>កាលបរិច្ឆេទ:</b> ${dateString}\n`; message += `<b>មូលហេតុ:</b> ${requestData.reason}\n\n`; message += `(សូមចូល Firestore ដើម្បីពិនិត្យ ID: \`${requestId}\`)`; await sendTelegramNotification(message); if (leaveRequestLoadingEl) leaveRequestLoadingEl.classList.add('hidden'); showCustomAlert('ជោគជ័យ!', 'សំណើរបស់អ្នកត្រូវបានផ្ញើដោយជោគជ័យ!', 'success'); navigateTo('page-history'); } catch (error) { console.error("Error submitting leave request:", error); let displayError = error.message; if (error.code?.includes('permission-denied')) displayError = 'Missing or insufficient permissions. សូមពិនិត្យ Firestore Rules។'; if (leaveRequestErrorEl) { leaveRequestErrorEl.textContent = `Error: ${displayError}`; leaveRequestErrorEl.classList.remove('hidden'); } if (leaveRequestLoadingEl) leaveRequestLoadingEl.classList.add('hidden'); if (submitLeaveRequestBtn) submitLeaveRequestBtn.disabled = false; } });

    // --- Out Request Logic ---
    if (openOutRequestBtn) openOutRequestBtn.addEventListener('click', () => { if (!currentUser) return showCustomAlert("Error", "សូម Login ជាមុនសិន។"); const reqPhoto = document.getElementById('request-out-user-photo'); const reqName = document.getElementById('request-out-user-name'); const reqId = document.getElementById('request-out-user-id'); const reqDept = document.getElementById('request-out-user-department'); if(reqPhoto) reqPhoto.src = currentUser.photo || 'https://placehold.co/60x60/e2e8f0/64748b?text=User'; if(reqName) reqName.textContent = currentUser.name; if(reqId) reqId.textContent = currentUser.id; if(reqDept) reqDept.textContent = currentUser.department || 'មិនមាន'; if (outDurationSearchInput) outDurationSearchInput.value = ''; if (outReasonSearchInput) outReasonSearchInput.value = ''; if (outDateInput) outDateInput.value = getTodayString('dd/mm/yyyy'); selectedOutDuration = null; selectedOutReason = null; if (outRequestErrorEl) outRequestErrorEl.classList.add('hidden'); if (outRequestLoadingEl) outRequestLoadingEl.classList.add('hidden'); if (submitOutRequestBtn) submitOutRequestBtn.disabled = false; navigateTo('page-request-out'); });
    if (cancelOutRequestBtn) cancelOutRequestBtn.addEventListener('click', () => navigateTo('page-home'));
    if (submitOutRequestBtn) submitOutRequestBtn.addEventListener('click', async () => { selectedOutDuration = outDurations.includes(outDurationSearchInput.value) ? outDurationSearchInput.value : null; selectedOutReason = outReasonSearchInput.value; if (!currentUser || !currentUser.id) return showCustomAlert("Error", "មានបញ្ហា៖ មិនអាចបញ្ជាក់អ្នកប្រើប្រាស់បានទេ។"); if (!selectedOutDuration) { if (outRequestErrorEl) { outRequestErrorEl.textContent = 'សូមជ្រើសរើស "រយៈពេល" ឲ្យបានត្រឹមត្រូវ (ពីក្នុងបញ្ជី)។'; outRequestErrorEl.classList.remove('hidden'); } return; } if (!selectedOutReason || selectedOutReason.trim() === '') { if (outRequestErrorEl) { outRequestErrorEl.textContent = 'សូមបំពេញ "មូលហេតុ" ជាមុនសិន។'; outRequestErrorEl.classList.remove('hidden'); } return; } if (outRequestErrorEl) outRequestErrorEl.classList.add('hidden'); if (outRequestLoadingEl) outRequestLoadingEl.classList.remove('hidden'); if (submitOutRequestBtn) submitOutRequestBtn.disabled = true; try { const dateVal = outDateInput ? outDateInput.value : getTodayString('dd/mm/yyyy'); const requestId = `out_${Date.now()}`; const requestData = { userId: currentUser.id, name: currentUser.name, department: currentUser.department || 'N/A', photo: currentUser.photo || null, duration: selectedOutDuration, reason: selectedOutReason.trim(), startDate: formatDateToDdMmmYyyy(dateVal), endDate: formatDateToDdMmmYyyy(dateVal), status: 'pending', requestedAt: serverTimestamp(), requestId: requestId, firestoreUserId: auth.currentUser ? auth.currentUser.uid : 'unknown_auth_user' }; if (!db || !outRequestsCollectionPath) throw new Error("Firestore DB or Out Collection Path is not initialized."); const requestRef = doc(db, outRequestsCollectionPath, requestId); await setDoc(requestRef, requestData); console.log("Firestore (out) write successful."); let message = `<b>🔔 សំណើសុំច្បាប់ចេញក្រៅ 🔔</b>\n\n`; message += `<b>ឈ្មោះ:</b> ${requestData.name} (${requestData.userId})\n`; message += `<b>ផ្នែក:</b> ${requestData.department}\n`; message += `<b>រយៈពេល:</b> ${requestData.duration}\n`; message += `<b>កាលបរិច្ឆេទ:</b> ${requestData.startDate}\n`; message += `<b>មូលហេតុ:</b> ${requestData.reason}\n\n`; message += `(សូមចូល Firestore ដើម្បីពិនិត្យ ID: \`${requestId}\`)`; await sendTelegramNotification(message); if (outRequestLoadingEl) outRequestLoadingEl.classList.add('hidden'); showCustomAlert('ជោគជ័យ!', 'សំណើរបស់អ្នកត្រូវបានផ្ញើដោយជោគជ័យ!', 'success'); navigateTo('page-history'); } catch (error) { console.error("Error submitting out request:", error); let displayError = error.message; if (error.code?.includes('permission-denied')) displayError = 'Missing or insufficient permissions. សូមពិនិត្យ Firestore Rules។'; if (outRequestErrorEl) { outRequestErrorEl.textContent = `Error: ${displayError}`; outRequestErrorEl.classList.remove('hidden'); } if (outRequestLoadingEl) outRequestLoadingEl.classList.add('hidden'); if (submitOutRequestBtn) submitOutRequestBtn.disabled = false; } });

    // --- Telegram Helper ---
    async function sendTelegramNotification(message) { console.log("Sending Telegram notification..."); try { const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`; const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' }) }); if (!res.ok) { const errBody = await res.text(); console.error("Telegram API error:", res.status, errBody); } else { console.log("Telegram notification sent successfully."); } } catch (e) { console.error("Failed to send Telegram message:", e); } }

    // --- Custom Alert Modal Logic ---
    function showCustomAlert(title, message, type = 'warning') { if (!customAlertModal) return; if (customAlertTitle) customAlertTitle.textContent = title; if (customAlertMessage) customAlertMessage.textContent = message; if (type === 'success') { if (customAlertIconSuccess) customAlertIconSuccess.classList.remove('hidden'); if (customAlertIconWarning) customAlertIconWarning.classList.add('hidden'); } else { if (customAlertIconSuccess) customAlertIconSuccess.classList.add('hidden'); if (customAlertIconWarning) customAlertIconWarning.classList.remove('hidden'); } customAlertModal.classList.remove('hidden'); }
    function hideCustomAlert() { if (customAlertModal) customAlertModal.classList.add('hidden'); }

    // --- History Page Logic (Real-time) ---
    function setupHistoryListeners(currentEmployeeId) { console.log("Setting up history listeners for employee ID:", currentEmployeeId); if (historyUnsubscribe) historyUnsubscribe(); if (outHistoryUnsubscribe) outHistoryUnsubscribe(); if (!db || !currentEmployeeId) return console.error("Firestore DB not initialized or Employee ID not set."); const now = new Date(); const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1); const startTimestamp = Timestamp.fromDate(startOfMonth); const endTimestamp = Timestamp.fromDate(endOfMonth); try { const leaveQuery = query(collection(db, leaveRequestsCollectionPath), where("userId", "==", currentEmployeeId), where("requestedAt", ">=", startTimestamp), where("requestedAt", "<", endTimestamp)); console.log("Querying Leave Requests for current month..."); historyUnsubscribe = onSnapshot(leaveQuery, (snapshot) => { console.log(`Received LEAVE snapshot. Size: ${snapshot.size}`); renderHistoryList(snapshot, historyContainerLeave, historyPlaceholderLeave, 'leave'); }, (error) => { console.error("Error listening to LEAVE history:", error); if (historyPlaceholderLeave) { historyPlaceholderLeave.innerHTML = `<p class="text-red-500">Error: មិនអាចទាញយកប្រវត្តិបានទេ ${error.code.includes('permission-denied') ? '(Permission Denied)' : (error.code.includes('requires an index') ? '(ត្រូវបង្កើត Index សូមមើល Console)' : '')}</p>`; historyPlaceholderLeave.classList.remove('hidden'); } }); } catch (e) { console.error("Failed to create LEAVE history query:", e); if (historyPlaceholderLeave) historyPlaceholderLeave.innerHTML = `<p class="text-red-500">Error: ${e.message}</p>`; historyPlaceholderLeave.classList.remove('hidden'); } try { const outQuery = query(collection(db, outRequestsCollectionPath), where("userId", "==", currentEmployeeId), where("requestedAt", ">=", startTimestamp), where("requestedAt", "<", endTimestamp)); console.log("Querying Out Requests for current month..."); outHistoryUnsubscribe = onSnapshot(outQuery, (snapshot) => { console.log(`Received OUT snapshot. Size: ${snapshot.size}`); renderHistoryList(snapshot, historyContainerOut, historyPlaceholderOut, 'out'); }, (error) => { console.error("Error listening to OUT history:", error); if (historyPlaceholderOut) { historyPlaceholderOut.innerHTML = `<p class="text-red-500">Error: មិនអាចទាញយកប្រវត្តិបានទេ ${error.code.includes('permission-denied') ? '(Permission Denied)' : (error.code.includes('requires an index') ? '(ត្រូវបង្កើត Index សូមមើល Console)' : '')}</p>`; historyPlaceholderOut.classList.remove('hidden'); } }); } catch (e) { console.error("Failed to create OUT history query:", e); if (historyPlaceholderOut) historyPlaceholderOut.innerHTML = `<p class="text-red-500">Error: ${e.message}</p>`; historyPlaceholderOut.classList.remove('hidden'); } }
    function getSortPriority(status) { switch(status) { case 'pending': return 1; case 'editing': return 2; case 'approved': return 3; case 'rejected': return 4; default: return 5; } }
    function renderHistoryList(snapshot, container, placeholder, type) {
        if (!container || !placeholder) return;
        const requests = []; 
        if (snapshot.empty) {
            placeholder.classList.remove('hidden');
            container.innerHTML = '';
        } else {
            placeholder.classList.add('hidden');
            container.innerHTML = '';
            snapshot.forEach(doc => requests.push(doc.data()));
            requests.sort((a, b) => {
                const priorityA = getSortPriority(a.status);
                const priorityB = getSortPriority(b.status);
                if (priorityA !== priorityB) return priorityA - priorityB;
                const timeA = a.requestedAt?.toMillis() ?? 0;
                const timeB = b.requestedAt?.toMillis() ?? 0;
                return timeB - timeA;
            });
            requests.forEach(request => container.innerHTML += renderHistoryCard(request, type));
        }

        if (type === 'leave') {
            const hasPendingLeave = !snapshot.empty && (requests[0].status === 'pending' || requests[0].status === 'editing');
            updateLeaveButtonState(hasPendingLeave);
        } else if (type === 'out') {
            let hasActiveOut = false;
            if (!snapshot.empty) {
                if (requests[0].status === 'pending' || requests[0].status === 'editing') {
                    hasActiveOut = true;
                } else {
                    hasActiveOut = requests.some(r => r.status === 'approved' && r.returnStatus !== 'បានចូលមកវិញ');
                }
            }
            updateOutButtonState(hasActiveOut);
        }
    }
    function renderHistoryCard(request, type) { if (!request || !request.requestId) return ''; let statusColor, statusText, decisionInfo = ''; switch(request.status) { case 'approved': statusColor = 'bg-green-100 text-green-800'; statusText = 'បានយល់ព្រម'; if (request.decisionAt) decisionInfo = `<p class="text-xs text-green-600 mt-1">នៅម៉ោង: ${formatFirestoreTimestamp(request.decisionAt, 'time')}</p>`; break; case 'rejected': statusColor = 'bg-red-100 text-red-800'; statusText = 'បានបដិសេធ'; if (request.decisionAt) decisionInfo = `<p class="text-xs text-red-600 mt-1">នៅម៉ោង: ${formatFirestoreTimestamp(request.decisionAt, 'time')}</p>`; break; case 'editing': statusColor = 'bg-blue-100 text-blue-800'; statusText = 'កំពុងកែសម្រួល'; break; default: statusColor = 'bg-yellow-100 text-yellow-800'; statusText = 'កំពុងរង់ចាំ'; } const dateString = (request.startDate === request.endDate) ? request.startDate : (request.startDate && request.endDate ? `${request.startDate} ដល់ ${request.endDate}` : 'N/A'); const showActions = (request.status === 'pending' || request.status === 'editing'); let returnInfo = ''; let returnButton = ''; if (type === 'out') { if (request.returnStatus === 'បានចូលមកវិញ') returnInfo = `<p class="text-sm font-semibold text-green-700 mt-2">✔️ បានចូលមកវិញ: ${request.returnedAt || ''}</p>`; else if (request.status === 'approved') returnButton = `<button data-id="${request.requestId}" class="return-btn w-full mt-3 py-2 px-3 bg-green-600 text-white rounded-lg font-semibold text-sm shadow-sm hover:bg-green-700">បញ្ជាក់ចូលមកវិញ</button>`; } let invoiceButton = ''; if (request.status === 'approved') invoiceButton = `<button data-id="${request.requestId}" data-type="${type}" class="invoice-btn mt-3 py-1.5 px-3 bg-indigo-100 text-indigo-700 rounded-md font-semibold text-xs shadow-sm hover:bg-indigo-200 w-full sm:w-auto">ពិនិត្យមើលវិក័យប័ត្រ</button>`; return `<div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4"><div class="flex justify-between items-start"><span class="font-semibold text-gray-800">${request.duration || 'N/A'}</span><span class="text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}">${statusText}</span></div><p class="text-sm text-gray-600 mt-1">${dateString}</p><p class="text-sm text-gray-500 mt-1"><b>មូលហេតុ:</b> ${request.reason || 'មិនបានបញ្ជាក់'}</p>${decisionInfo}${returnInfo}<div class="mt-3 pt-3 border-t border-gray-100"><div class="flex flex-wrap justify-between items-center gap-2"><p class="text-xs text-gray-400">ID: ${request.requestId}</p>${showActions ? `<div class="flex space-x-2"><button data-id="${request.requestId}" data-type="${type}" class="edit-btn p-1 text-blue-600 hover:text-blue-800"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button data-id="${request.requestId}" data-type="${type}" class="delete-btn p-1 text-red-600 hover:text-red-800"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div>` : ''}${invoiceButton}</div>${returnButton}</div></div>`; }
    function updateLeaveButtonState(isDisabled) {
        if (!openLeaveRequestBtn) return; 
        const leaveBtnText = openLeaveRequestBtn.querySelector('p.text-xs');
        if (isDisabled) {
            openLeaveRequestBtn.disabled = true;
            openLeaveRequestBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
            openLeaveRequestBtn.classList.remove('bg-blue-50', 'hover:bg-blue-100');
            if (leaveBtnText) leaveBtnText.textContent = 'មានសំណើកំពុងរង់ចាំ';
        } else {
            openLeaveRequestBtn.disabled = false;
            openLeaveRequestBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
            openLeaveRequestBtn.classList.add('bg-blue-50', 'hover:bg-blue-100');
            if (leaveBtnText) leaveBtnText.textContent = 'ឈប់សម្រាក';
        }
    }
    function updateOutButtonState(isDisabled) {
        if (!openOutRequestBtn) return;
        const outBtnText = openOutRequestBtn.querySelector('p.text-xs');
        if (isDisabled) {
            openOutRequestBtn.disabled = true;
            openOutRequestBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
            openOutRequestBtn.classList.remove('bg-green-50', 'hover:bg-green-100');
            if (outBtnText) outBtnText.textContent = 'មានសំណើកំពុងដំណើរការ';
        } else {
            openOutRequestBtn.disabled = false;
            openOutRequestBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
            openOutRequestBtn.classList.add('bg-green-50', 'hover:bg-green-100');
            if (outBtnText) outBtnText.textContent = 'ចេញក្រៅផ្ទាល់ខ្លួន';
        }
    }

    // --- Edit Modal Logic ---
    async function openEditModal(requestId, type) { if (!db || !requestId || !type) return; const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath; if (!collectionPath) return; if (editLoadingEl) editLoadingEl.classList.remove('hidden'); if (editErrorEl) editErrorEl.classList.add('hidden'); if (editModal) editModal.classList.remove('hidden'); try { const requestRef = doc(db, collectionPath, requestId); await updateDoc(requestRef, { status: 'editing' }); console.log("Request status set to 'editing'"); const docSnap = await getDoc(requestRef); if (!docSnap.exists()) throw new Error("Document not found"); const data = docSnap.data(); if (editModalTitle) editModalTitle.textContent = (type === 'leave') ? "កែសម្រួលច្បាប់ឈប់" : "កែសម្រួលច្បាប់ចេញក្រៅ"; if (editRequestId) editRequestId.value = requestId; if (editReasonSearch) editReasonSearch.value = data.reason || ''; if (editDurationSearch) editDurationSearch.value = data.duration; setupSearchableDropdown('edit-duration-search', 'edit-duration-dropdown', (type === 'leave' ? leaveDurationItems : outDurationItems), () => {}, false); setupSearchableDropdown('edit-reason-search', 'edit-reason-dropdown', (type === 'leave' ? leaveReasonItems : outReasonItems), () => {}, true); if (type === 'leave') { if (singleDayLeaveDurations.includes(data.duration)) { if (editSingleDateContainer) editSingleDateContainer.classList.remove('hidden'); if (editDateRangeContainer) editDateRangeContainer.classList.add('hidden'); if (editLeaveDateSingle) editLeaveDateSingle.value = data.startDate; } else { if (editSingleDateContainer) editSingleDateContainer.classList.add('hidden'); if (editDateRangeContainer) editDateRangeContainer.classList.remove('hidden'); if (editLeaveDateStart) editLeaveDateStart.value = parseDdMmmYyyyToInputFormat(data.startDate); if (editLeaveDateEnd) editLeaveDateEnd.value = parseDdMmmYyyyToInputFormat(data.endDate); } } else { if (editSingleDateContainer) editSingleDateContainer.classList.remove('hidden'); if (editDateRangeContainer) editDateRangeContainer.classList.add('hidden'); if (editLeaveDateSingle) editLeaveDateSingle.value = data.startDate; } if (editLoadingEl) editLoadingEl.classList.add('hidden'); } catch (e) { console.error("Error opening edit modal:", e); if (editLoadingEl) editLoadingEl.classList.add('hidden'); if (editErrorEl) { editErrorEl.textContent = `Error: ${e.message}`; editErrorEl.classList.remove('hidden'); } } }
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', async () => { const requestId = editRequestId.value; const type = (editModalTitle.textContent.includes("ឈប់")) ? 'leave' : 'out'; const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath; if (requestId && collectionPath) { try { const requestRef = doc(db, collectionPath, requestId); await updateDoc(requestRef, { status: 'pending' }); console.log("Edit cancelled, status reverted to 'pending'"); } catch (e) { console.error("Error reverting status on edit cancel:", e); } } if (editModal) editModal.classList.add('hidden'); });
    if (submitEditBtn) submitEditBtn.addEventListener('click', async () => { const requestId = editRequestId.value; const type = (editModalTitle.textContent.includes("ឈប់")) ? 'leave' : 'out'; const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath; const newReason = editReasonSearch.value; if (!requestId || !collectionPath || !newReason || newReason.trim() === '') { if(editErrorEl) { editErrorEl.textContent = "មូលហេតុមិនអាចទទេបានទេ។"; editErrorEl.classList.remove('hidden'); } return; } if (editLoadingEl) editLoadingEl.classList.remove('hidden'); if (editErrorEl) editErrorEl.classList.add('hidden'); try { const requestRef = doc(db, collectionPath, requestId); await updateDoc(requestRef, { reason: newReason.trim(), status: 'pending', requestedAt: serverTimestamp() }); console.log("Edit submitted, status set to 'pending'"); let message = `<b>🔔 សំណើត្រូវបានកែសម្រួល 🔔</b>\n\n`; message += `<b>ID:</b> \`${requestId}\`\n`; message += `<b>មូលហេតុថ្មី:</b> ${newReason.trim()}\n\n`; message += `(សំណើនេះ ឥឡូវនេះ ស្ថិតក្នុងស្ថានភាព \'pending\' ឡើងវិញ)`; await sendTelegramNotification(message); if (editLoadingEl) editLoadingEl.classList.add('hidden'); if (editModal) editModal.classList.add('hidden'); } catch (e) { console.error("Error submitting edit:", e); if (editLoadingEl) editLoadingEl.classList.add('hidden'); if (editErrorEl) { editErrorEl.textContent = `Error: ${e.message}`; editErrorEl.classList.remove('hidden'); } } });

    // --- Delete Modal Logic ---
    function openDeleteModal(requestId, type) { if (deleteRequestId) deleteRequestId.value = requestId; if (deleteCollectionType) deleteCollectionType.value = type; if (deleteModal) deleteModal.classList.remove('hidden'); }
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => { if (deleteModal) deleteModal.classList.add('hidden'); });
    if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', async () => { const requestId = deleteRequestId.value; const type = deleteCollectionType.value; const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath; if (!db || !requestId || !collectionPath) { console.error("Cannot delete: Missing info"); return showCustomAlert("Error", "មិនអាចលុបបានទេ។"); } console.log("Attempting to delete doc:", requestId, "from:", collectionPath); deleteConfirmBtn.disabled = true; deleteConfirmBtn.textContent = 'កំពុងលុប...'; try { const requestRef = doc(db, collectionPath, requestId); await deleteDoc(requestRef); console.log("Document successfully deleted!"); if (deleteModal) deleteModal.classList.add('hidden'); } catch (e) { console.error("Error deleting document:", e); showCustomAlert("Error", `មិនអាចលុបបានទេ។ ${e.message}`); } finally { deleteConfirmBtn.disabled = false; deleteConfirmBtn.textContent = 'យល់ព្រមលុប'; } });

    // --- RETURN CONFIRMATION LOGIC ---
    function isPointInPolygon(point, polygon) { const [lat, lng] = point; let isInside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const [lat_i, lng_i] = polygon[i]; const [lat_j, lng_j] = polygon[j]; const intersect = ((lng_i > lng) !== (lng_j > lng)) && (lat < (lat_j - lat_i) * (lng - lng_i) / (lng_j - lng_i) + lat_i); if (intersect) isInside = !isInside; } return isInside; }

    /**
     * មុខងារថ្មីសម្រាប់ stopReturnScan (ប្រើ rAF)
     */
    function stopReturnScan(clearId = true) { 
        stopAdvancedFaceAnalysis(); // បញ្ឈប់ Loop rAF
        if (returnVideo && returnVideo.srcObject) { 
            returnVideo.srcObject.getTracks().forEach(track => track.stop()); 
            returnVideo.srcObject = null; 
        } 
        if (clearId) currentReturnRequestId = null; 
    }

    async function startReturnConfirmation(requestId) { 
        console.log("startReturnConfirmation called for:", requestId); 
        if (!currentUser || !currentUser.photo) { 
            showCustomAlert("Error", "មិនអាចទាញយករូបថតយោងរបស់អ្នកបានទេ។"); 
            return; 
        } 
        currentReturnRequestId = requestId; 
        if (returnScanModal) returnScanModal.classList.remove('hidden'); 
        if (returnScanStatusEl) returnScanStatusEl.textContent = 'កំពុងព្យាយាមបើកកាមេរ៉ា...'; 
        if (returnScanDebugEl) returnScanDebugEl.textContent = ''; 
        
        try { 
            if (returnScanStatusEl) returnScanStatusEl.textContent = 'កំពុងវិភាគរូបថតយោង...'; 
            const referenceDescriptor = await getReferenceDescriptor(currentUser.photo); 
            if (returnScanStatusEl) returnScanStatusEl.textContent = 'កំពុងស្នើសុំបើកកាមេរ៉ា...'; 
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} }); 

            // --- START: MODIFIED BLOCK (rAF) ---
            if (returnVideo) returnVideo.srcObject = stream; 
            if (returnScanStatusEl) returnScanStatusEl.textContent = 'សូមដាក់មុខរបស់អ្នកឲ្យចំកាមេរ៉ា'; 

            stopAdvancedFaceAnalysis(); // បញ្ឈប់ Loop ចាស់ (ប្រសិនបើមាន)

            // កំណត់អ្វីដែលត្រូវធ្វើនៅពេលជោគជ័យ
            const onSuccess = () => {
                console.log("Return Scan Success!");
                // Loop ឈប់ដោយខ្លួនឯង តែយើងត្រូវបិទវីដេអូ
                if (returnVideo && returnVideo.srcObject) { 
                    returnVideo.srcObject.getTracks().forEach(track => track.stop()); 
                    returnVideo.srcObject = null; 
                }
                // បន្តទៅពិនិត្យទីតាំង
                handleReturnFaceScanSuccess(); 
            };

            // ហៅ Function វិភាគថ្មី
            startAdvancedFaceAnalysis(
                returnVideo, 
                returnScanStatusEl, 
                returnScanDebugEl, 
                referenceDescriptor, 
                onSuccess
            );
            // --- END: MODIFIED BLOCK (rAF) ---

        } catch (error) { 
            console.error("Error during return scan process:", error); 
            if (returnScanStatusEl) returnScanStatusEl.textContent = `Error: ${error.message}`; 
            stopReturnScan(true); // ហៅ stopReturnScan ពេលមានបញ្ហា
            setTimeout(() => { 
                if (returnScanModal) returnScanModal.classList.add('hidden'); 
                showCustomAlert("បញ្ហាស្កេនមុខ", `មានបញ្ហា៖\n${error.message}\nសូមប្រាកដថាអ្នកបានអនុញ្ញាតឲ្យប្រើកាមេរ៉ា។`); 
            }, 1500); 
        } 
    }

    if (cancelReturnScanBtn) cancelReturnScanBtn.addEventListener('click', () => { 
        stopReturnScan(true); // ហៅ stopReturnScan (ដែលរួមបញ្ចូលការ stop rAF)
        if (returnScanModal) returnScanModal.classList.add('hidden'); 
    });
    
    function handleReturnFaceScanSuccess() { if (returnScanStatusEl) returnScanStatusEl.textContent = 'ស្កេនមុខជោគជ័យ!\nកំពុងស្នើសុំទីតាំង...'; if (returnScanDebugEl) returnScanDebugEl.textContent = 'សូមអនុញ្ញាតឲ្យប្រើ Location'; if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }); } else { console.error("Geolocation is not supported."); showCustomAlert("បញ្ហាទីតាំង", LOCATION_FAILURE_MESSAGE); if (returnScanModal) returnScanModal.classList.add('hidden'); currentReturnRequestId = null; } }
    async function onLocationSuccess(position) { const userLat = position.coords.latitude; const userLng = position.coords.longitude; console.log(`Location found: ${userLat}, ${userLng}`); if (returnScanStatusEl) returnScanStatusEl.textContent = 'បានទីតាំង! កំពុងពិនិត្យ...'; if (returnScanDebugEl) returnScanDebugEl.textContent = `Lat: ${userLat.toFixed(6)}, Lng: ${userLng.toFixed(6)}`; const isInside = isPointInPolygon([userLat, userLng], allowedAreaCoords); if (isInside) { console.log("User is INSIDE."); if (returnScanStatusEl) returnScanStatusEl.textContent = 'ទីតាំងត្រឹមត្រូវ! កំពុងរក្សាទុក...'; await updateReturnStatusInFirestore(); } else { console.log("User is OUTSIDE."); if (returnScanStatusEl) returnScanStatusEl.textContent = 'ទីតាំងមិនត្រឹមត្រូវ។'; showCustomAlert("បញ្ហាទីតាំង", LOCATION_FAILURE_MESSAGE); if (returnScanModal) returnScanModal.classList.add('hidden'); currentReturnRequestId = null; } }
    function onLocationError(error) { console.error(`Geolocation Error (${error.code}): ${error.message}`); if (returnScanStatusEl) returnScanStatusEl.textContent = 'មិនអាចទាញយកទីតាំងបានទេ។'; showCustomAlert("បញ្ហាទីតាំង", LOCATION_FAILURE_MESSAGE); if (returnScanModal) returnScanModal.classList.add('hidden'); currentReturnRequestId = null; }
    async function updateReturnStatusInFirestore() { if (!currentReturnRequestId) { console.error("Cannot update return status: No request ID"); return; } try { const docRef = doc(db, outRequestsCollectionPath, currentReturnRequestId); const now = new Date(); const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); const returnedAtString = `${time} ${date}`; await updateDoc(docRef, { returnStatus: "បានចូលមកវិញ", returnedAt: returnedAtString }); console.log("Return status updated successfully."); showCustomAlert("ជោគជ័យ!", "បញ្ជាក់ការចូលមកវិញ បានជោគជ័យ!", "success"); } catch (e) { console.error("Error updating Firestore return status:", e); showCustomAlert("Error", `មានបញ្ហាពេលរក្សាទុក: ${e.message}`); } finally { if (returnScanModal) returnScanModal.classList.add('hidden'); currentReturnRequestId = null; } }

    // --- INVOICE MODAL LOGIC ---
    function hideInvoiceModal() { if (invoiceModal) invoiceModal.classList.add('hidden'); if (invoiceShareStatus) invoiceShareStatus.textContent = ''; if (shareInvoiceBtn) shareInvoiceBtn.disabled = false; }
    async function openInvoiceModal(requestId, type) { console.log(`--- Attempting to open invoice for ${type} request ID: ${requestId} ---`); if (!db || !requestId || !type) { showCustomAlert("Error", "មិនអាចបើកវិក័យប័ត្របានទេ (Missing ID or Type)"); return; } const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath; if (!collectionPath) { showCustomAlert("Error", "មិនអាចបើកវិក័យប័ត្របានទេ (Invalid Collection Path)"); return; } if (!invoiceModal) { console.error("Invoice modal element not found!"); return; } invoiceModal.classList.remove('hidden'); if(invoiceUserName) invoiceUserName.textContent='កំពុងទាញយក...'; if(invoiceUserId) invoiceUserId.textContent='...'; if(invoiceUserDept) invoiceUserDept.textContent='...'; if(invoiceRequestType) invoiceRequestType.textContent='...'; if(invoiceDuration) invoiceDuration.textContent='...'; if(invoiceDates) invoiceDates.textContent='...'; if(invoiceReason) invoiceReason.textContent='...'; if(invoiceApprover) invoiceApprover.textContent='...'; if(invoiceDecisionTime) invoiceDecisionTime.textContent='...'; if(invoiceRequestId) invoiceRequestId.textContent='...'; if(invoiceReturnInfo) invoiceReturnInfo.classList.add('hidden'); if(shareInvoiceBtn) shareInvoiceBtn.disabled = true; try { const docRef = doc(db, collectionPath, requestId); console.log("Fetching Firestore doc:", docRef.path); const docSnap = await getDoc(docRef); if (!docSnap.exists()) { throw new Error("រកមិនឃើញសំណើរនេះទេ។"); } console.log("Firestore doc found."); const data = docSnap.data(); const requestTypeText = (type === 'leave') ? 'ច្បាប់ឈប់សម្រាក' : 'ច្បាប់ចេញក្រៅ'; const decisionTimeText = formatFirestoreTimestamp(data.decisionAt || data.requestedAt); const dateRangeText = (data.startDate === data.endDate) ? data.startDate : `${data.startDate} ដល់ ${data.endDate}`; if(invoiceModalTitle) invoiceModalTitle.textContent = `វិក័យប័ត្រ - ${requestTypeText}`; if(invoiceUserName) invoiceUserName.textContent = data.name || 'N/A'; if(invoiceUserId) invoiceUserId.textContent = data.userId || 'N/A'; if(invoiceUserDept) invoiceUserDept.textContent = data.department || 'N/A'; if(invoiceRequestType) invoiceRequestType.textContent = requestTypeText; if(invoiceDuration) invoiceDuration.textContent = data.duration || 'N/A'; if(invoiceDates) invoiceDates.textContent = dateRangeText; if(invoiceReason) invoiceReason.textContent = data.reason || 'N/Examples/N/A'; if(invoiceApprover) invoiceApprover.textContent = "លោកគ្រូ ពៅ ដារ៉ូ"; if(invoiceDecisionTime) invoiceDecisionTime.textContent = decisionTimeText; if(invoiceRequestId) invoiceRequestId.textContent = data.requestId || requestId; if (type === 'out' && data.returnStatus === 'បានចូលមកវិញ') { if (invoiceReturnStatus) invoiceReturnStatus.textContent = data.returnStatus; if (invoiceReturnTime) invoiceReturnTime.textContent = data.returnedAt || 'N/A'; if (invoiceReturnInfo) invoiceReturnInfo.classList.remove('hidden'); } else { if (invoiceReturnInfo) invoiceReturnInfo.classList.add('hidden'); } if(shareInvoiceBtn) { shareInvoiceBtn.dataset.requestId = data.requestId || requestId; shareInvoiceBtn.dataset.userName = data.name || 'User'; shareInvoiceBtn.dataset.requestType = requestTypeText; shareInvoiceBtn.disabled = false; } console.log("Invoice modal populated."); } catch (error) { console.error("Error opening/populating invoice modal:", error); hideInvoiceModal(); showCustomAlert("Error", `មិនអាចផ្ទុកទិន្នន័យវិក័យប័ត្របានទេ: ${error.message}`); } }
    async function shareInvoiceAsImage() { if (!invoiceContent || typeof html2canvas === 'undefined' || !shareInvoiceBtn) { showCustomAlert("Error", "មុខងារ Share មិនទាន់រួចរាល់ ឬ Library បាត់។"); return; } if(invoiceShareStatus) invoiceShareStatus.textContent = 'កំពុងបង្កើតរូបភាព...'; shareInvoiceBtn.disabled = true; try { if(invoiceContentWrapper) invoiceContentWrapper.scrollTop = 0; await new Promise(resolve => setTimeout(resolve, 100)); const canvas = await html2canvas(invoiceContent, { scale: 2, useCORS: true, logging: false }); canvas.toBlob(async (blob) => { if (!blob) { throw new Error("មិនអាចបង្កើតរូបភាព Blob បានទេ។"); } if(invoiceShareStatus) invoiceShareStatus.textContent = 'កំពុងព្យាយាម Share...'; if (navigator.share && navigator.canShare) { const fileName = `Invoice_${shareInvoiceBtn.dataset.requestId || 'details'}.png`; const file = new File([blob], fileName, { type: blob.type }); const shareData = { files: [file], title: `វិក័យប័ត្រសុំច្បាប់ (${shareInvoiceBtn.dataset.requestType || ''})`, text: `វិក័យប័ត្រសុំច្បាប់សម្រាប់ ${shareInvoiceBtn.dataset.userName || ''} (ID: ${shareInvoiceBtn.dataset.requestId || ''})`, }; if (navigator.canShare(shareData)) { try { await navigator.share(shareData); console.log('Invoice shared successfully via Web Share API'); if(invoiceShareStatus) invoiceShareStatus.textContent = 'Share ជោគជ័យ!'; } catch (err) { console.error('Web Share API error:', err); if(invoiceShareStatus) invoiceShareStatus.textContent = 'Share ត្រូវបានបោះបង់។'; if (err.name !== 'AbortError') showCustomAlert("Share Error", "មិនអាច Share បានតាម Web Share API។ សូមព្យាយាមម្តងទៀត។"); } } else { console.warn('Web Share API cannot share this data.'); if(invoiceShareStatus) invoiceShareStatus.textContent = 'មិនអាច Share file បាន។'; showCustomAlert("Share Error", "Browser នេះមិនគាំទ្រការ Share file ទេ។ សូមធ្វើការ Screenshot ដោយដៃ។"); } } else { console.warn('Web Share API not supported.'); if(invoiceShareStatus) invoiceShareStatus.textContent = 'Web Share មិនដំណើរការ។'; showCustomAlert("សូម Screenshot", "Browser នេះមិនគាំទ្រ Web Share API ទេ។ សូមធ្វើការ Screenshot វិក័យប័ត្រនេះដោយដៃ រួច Share ទៅ Telegram។"); } shareInvoiceBtn.disabled = false; }, 'image/png'); } catch (error) { console.error("Error generating or sharing invoice image:", error); if(invoiceShareStatus) invoiceShareStatus.textContent = 'Error!'; showCustomAlert("Error", `មានបញ្ហាក្នុងការបង្កើត ឬ Share រូបភាព: ${error.message}`); shareInvoiceBtn.disabled = false; } }

    // === Logic ថ្មី​សម្រាប់​ទំព័រ​វត្តមាន ===
    if (openDailyAttendanceBtn) {
        openDailyAttendanceBtn.addEventListener('click', () => {
            console.log("Opening Daily Attendance page...");
            if (attendanceIframe) {
                // កំណត់ src ដើម្បី​ចាប់ផ្តើម​ផ្ទុក (load) ទំព័រ
                attendanceIframe.src = 'https://darotrb0-bit.github.io/MMKDailyattendance/';
            }
            navigateTo('page-daily-attendance');
        });
    }

    if (closeAttendancePageBtn) {
        closeAttendancePageBtn.addEventListener('click', () => {
            console.log("Closing Daily Attendance page...");
            if (attendanceIframe) {
                // សំខាន់៖ ត្រូវ​កំណត់ src ទៅជាទទេ ដើម្បី​បិទ​កាមេរ៉ា
                attendanceIframe.src = 'about:blank'; 
            }
            navigateTo('page-home');
        });
    }

}); // End of DOMContentLoaded
