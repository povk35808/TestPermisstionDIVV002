// ========== File: face-scan.js (1 of 2) ==========
// នេះគឺជា "ខួរក្បាល" ថ្មី សម្រាប់គ្រប់គ្រងការស្កេនមុខ

// យក Global variable 'faceapi' មកប្រើក្នុង Module
const faceapi = window.faceapi;

// --- Module-level State ---
let userReferenceDescriptor = null;
let isFaceAnalysisRunning = false;
let lastFaceCheck = 0;
// ប្រើ 500ms ព្រោះ SsdMobilenetv1 ធ្ងន់ជាង 
// នេះជួយឲ្យកម្មវិធីរលូន (smooth) មិនគាំង (lag)
const FACE_CHECK_INTERVAL = 500;

// --- Helper Function សម្រាប់ប្តូរពណ៌ Oval Guide ---
/**
 * @param {HTMLElement | null} overlay
 * @param {'neutral' | 'good' | 'bad'} state
 */
function setOverlayState(overlay, state) {
    if (!overlay) return;

    // បញ្ជី Class ពណ៌ទាំងអស់
    const states = [
        'border-white', 'border-opacity-25', // neutral
        'border-red-500', 'border-opacity-100', // bad
        'border-green-500' // good
    ];
    
    // 1. លុបពណ៌ចាស់ចេញទាំងអស់
    overlay.classList.remove(...states);

    // 2. បន្ថែមពណ៌ថ្មី
    switch (state) {
        case 'good':
            overlay.classList.add('border-green-500', 'border-opacity-100');
            break;
        case 'bad':
            overlay.classList.add('border-red-500', 'border-opacity-100');
            break;
        default: // 'neutral'
            overlay.classList.add('border-white', 'border-opacity-25');
    }
}


// --- Exported Functions (មុខងារដែល `app.js` នឹងហៅប្រើ) ---

/**
 * [CRITICAL SECURITY FIX] លុប "កូនសោគោល" ចាស់ចោល
 */
export function clearReferenceDescriptor() {
    userReferenceDescriptor = null;
    console.log("Reference Descriptor Cleared.");
}

/**
 * ទាញយក Model ឆ្លាតវៃ (SsdMobilenetv1)
 * @param {HTMLElement} modelStatusEl - ធាតុ <p> សម្រាប់បង្ហាញសារ
 */
export async function loadFaceApiModels(modelStatusEl) {
    if (!modelStatusEl) return;
    try {
        console.log("Loading face-api models (SsdMobilenetv1)...");
        modelStatusEl.textContent = 'កំពុងទាញយក Model ស្កេនមុខ...';
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
            faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
        ]);
        modelStatusEl.textContent = 'Model ស្កេនមុខបានទាញយករួចរាល់';
        console.log("Face-api models loaded successfully (SsdMobilenetv1).");
        return true;
    } catch (error) {
        console.error("Error ពេលទាញយក Model របស់ face-api:", error);
        modelStatusEl.textContent = 'Error: មិនអាចទាញយក Model បាន';
        return false;
    }
}

/**
 * បង្កើត "កូនសោគោល" ពី URL រូបថត (ប្រើ Model ឆ្លាត)
 * @param {string} userPhotoUrl 
 */
export async function getReferenceDescriptor(userPhotoUrl) {
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

/**
 * បញ្ឈប់ Loop វិភាគផ្ទៃមុខ
 */
export function stopAdvancedFaceAnalysis() {
    console.log("Stopping Advanced Face Analysis...");
    isFaceAnalysisRunning = false;
}

/**
 * ចាប់ផ្តើមការវិភាគផ្ទៃមុខកម្រិតខ្ពស់ (rAF)
 * @param {HTMLVideoElement} videoElement
 * @param {HTMLElement} statusElement
 * @param {HTMLElement} debugElement
 * @param {string} overlayElementId - ID របស់រង្វង់ Oval Guide
 * @param {faceapi.L2EuclideanDistance} referenceDescriptor
 * @param {Function} onSuccessCallback
 */
export function startAdvancedFaceAnalysis(videoElement, statusElement, debugElement, overlayElementId, referenceDescriptor, onSuccessCallback) {
    console.log("Starting Advanced Face Analysis (rAF)...");
    isFaceAnalysisRunning = true;
    lastFaceCheck = 0; // Reset ម៉ោងពិនិត្យចុងក្រោយ

    const overlay = document.getElementById(overlayElementId);
    setOverlayState(overlay, 'neutral'); // Reset ពណ៌

    // --- កំណត់ "ច្បាប់" សម្រាប់ផ្ទៃមុខ ---
    const VERIFICATION_THRESHOLD = 0.5; // តឹងរ៉ឹងជាងមុន
    const MIN_WIDTH_PERCENT = 0.3;     // មុខត្រូវមានទំហំយ៉ាងតិច 30%
    const MAX_WIDTH_PERCENT = 0.7;     // មុខត្រូវមានទំហំយ៉ាងច្រើន 70%
    const CENTER_TOLERANCE_PERCENT = 0.2; // ទីតាំងកណ្តាល អាច lệch បាន 20%

    // គណនាទំហំជា pixels
    const videoWidth = videoElement.clientWidth || 320;
    const videoCenterX = videoWidth / 2;
    const minPixelWidth = videoWidth * MIN_WIDTH_PERCENT;
    const maxPixelWidth = videoWidth * MAX_WIDTH_PERCENT;
    const centerTolerancePixels = videoWidth * CENTER_TOLERANCE_PERCENT;
    
    console.log(`Analysis Rules: Threshold=<${VERIFICATION_THRESHOLD}, minWidth=${minPixelWidth}px, maxWidth=${maxPixelWidth}px`);

    async function analysisLoop(timestamp) {
        if (!isFaceAnalysisRunning) {
            setOverlayState(overlay, 'neutral'); // Reset ពណ៌ពេលឈប់
            return;
        }

        // --- Throttling Logic (រៀងរាល់ 500ms) ---
        if (timestamp - lastFaceCheck < FACE_CHECK_INTERVAL) {
            requestAnimationFrame(analysisLoop);
            return; 
        }
        lastFaceCheck = timestamp;
        // --- End Throttling ---

        try {
            if (!videoElement || videoElement.readyState < 3) {
                requestAnimationFrame(analysisLoop); 
                return; 
            }

            const detections = await faceapi.detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                                        .withFaceLandmarks(true)
                                        .withFaceDescriptor();

            if (!detections) {
                statusElement.textContent = 'រកមិនឃើញផ្ទៃមុខ...';
                debugElement.textContent = '';
                setOverlayState(overlay, 'neutral'); // ពណ៌ស (ធម្មតា)
            } else {
                const box = detections.detection.box;
                const faceCenterX = box.x + box.width / 2;
                
                if (box.width < minPixelWidth) {
                    statusElement.textContent = 'សូមរំកលមុខមកជិតបន្តិច';
                    debugElement.textContent = `ទំហំ: ${Math.round(box.width)}px (តូចពេក)`;
                    setOverlayState(overlay, 'bad'); // ពណ៌ក្រហម
                } 
                else if (box.width > maxPixelWidth) {
                    statusElement.textContent = 'សូមរំកលមុខថយក្រោយបន្តិច';
                    debugElement.textContent = `ទំហំ: ${Math.round(box.width)}px (ធំពេក)`;
                    setOverlayState(overlay, 'bad'); // ពណ៌ក្រហម
                } 
                else if (Math.abs(faceCenterX - videoCenterX) > centerTolerancePixels) {
                    statusElement.textContent = 'សូមដាក់មុខនៅចំកណ្តាល';
                    const distanceToCenter = Math.abs(faceCenterX - videoCenterX);
                    debugElement.textContent = ` lệch: ${Math.round(distanceToCenter)}px`;
                    setOverlayState(overlay, 'bad'); // ពណ៌ក្រហម
                } 
                else {
                    statusElement.textContent = 'រកឃើញ! កំពុងផ្ទៀងផ្ទាត់...';
                    setOverlayState(overlay, 'good'); // ពណ៌បៃតង
                    const distance = faceapi.euclideanDistance(referenceDescriptor, detections.descriptor);
                    
                    debugElement.textContent = `ចំងាយ: ${distance.toFixed(2)} (ត្រូវតែ < ${VERIFICATION_THRESHOLD})`;

                    if (distance < VERIFICATION_THRESHOLD) {
                        statusElement.textContent = 'ផ្ទៀងផ្ទាត់ជោគជ័យ!';
                        isFaceAnalysisRunning = false; // បញ្ឈប់ Loop
                        onSuccessCallback(); // ហៅ Function ជោគជ័យ
                        return; // --- ចេញពី Loop ---
                    } else {
                        statusElement.textContent = 'មុខមិនត្រឹមត្រូវ... សូមព្យាយាមម្តងទៀត';
                        setOverlayState(overlay, 'bad'); // ពណ៌ក្រហម (ផ្ទៀងផ្ទាត់បរាជ័យ)
                    }
                }
            }
        
        } catch (error) {
            console.error("Error during face analysis rAF loop:", error);
            statusElement.textContent = 'មានបញ្ហាពេលវិភាគ...';
            setOverlayState(overlay, 'bad');
        }
        
        requestAnimationFrame(analysisLoop);
    }
    requestAnimationFrame(analysisLoop);
}
