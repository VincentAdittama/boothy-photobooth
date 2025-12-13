import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance = null;

const isValidHttpUrl = (str) => {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

if (supabaseUrl && supabaseAnonKey) {
    if (isValidHttpUrl(supabaseUrl) && supabaseUrl !== 'your_project_url_here') {
        // Only create the client if the URL looks valid. Any errors thrown by createClient
        // would indicate a different/internal problem.
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } else {
        console.warn('Supabase credentials provided but the URL is invalid or a placeholder. Uploads will fail.');
    }
} else {
    console.warn('Supabase credentials missing or invalid. Uploads will fail.');
}

export const supabase = supabaseInstance;

/**
 * Uploads a photo blob to Supabase Storage and records it in the database.
 * @param {string} nickname - The user's nickname
 * @param {Blob} photoBlob - The image blob to upload
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
export const uploadPhoto = async (nickname, photoBlob) => {
    if (!supabase) {
        console.error("Supabase not initialized. Check .env");
        throw new Error("Supabase not configured");
    }
    if (!nickname) throw new Error("Nickname is required");

    // Create a unique file path: public/NICKNAME/TIMESTAMP.png
    const fileName = `${Date.now()}.png`;
    const filePath = `public/${nickname}/${fileName}`;

    // 1. Upload to Storage
    const { error: uploadError } = await supabase.storage
        .from('boothy-photos')
        .upload(filePath, photoBlob);

    if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        throw uploadError;
    }

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
        .from('boothy-photos')
        .getPublicUrl(filePath);

    // 3. Save Record to Database
    const { error: dbError } = await supabase
        .from('uploads')
        .insert({
            nickname: nickname,
            image_url: publicUrl
        });

    if (dbError) {
        console.error('Error saving to database:', dbError);
        throw dbError;
    }

    return publicUrl;
};

/**
 * Fetches all photos associated with a nickname.
 * @param {string} nickname - The user's nickname
 * @returns {Promise<Array>} - List of photo records
 */
export const getUserPhotos = async (nickname) => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('nickname', nickname)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching photos:', error);
        throw error;
    }

    return data;
};

/**
 * Generates a unique session ID for grouping photos from the same capture session.
 * @returns {string} - A unique session identifier
 */
export const generateSessionId = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Uploads a live photo capture to Supabase Storage (fire-and-forget).
 * This stores every snap (successful or not) for history purposes.
 * Users cannot retrieve these photos - it's one-way, write-only storage.
 * 
 * @param {Object} options - Upload options
 * @param {string} options.nickname - Username for categorization
 * @param {Blob|string} options.photoData - The image blob or data URL
 * @param {string} options.sessionId - Unique session identifier
 * @param {number} options.photoIndex - Which photo in the strip (0, 1, or 2)
 * @param {'snap'|'retake'} options.captureType - Type of capture
 */
export const uploadLivePhotoCapture = async ({
    nickname,
    photoData,
    sessionId,
    photoIndex,
    captureType = 'snap'
}) => {
    // Fire-and-forget: don't throw errors, just log them
    if (!supabase) {
        console.warn('[LivePhoto] Supabase not configured, skipping upload');
        return null;
    }

    if (!nickname || !photoData) {
        console.warn('[LivePhoto] Missing required data, skipping upload');
        return null;
    }

    try {
        // Convert data URL to blob if needed
        let blob = photoData;
        if (typeof photoData === 'string' && photoData.startsWith('data:')) {
            const res = await fetch(photoData);
            blob = await res.blob();
        }

        // Create unique file path: nickname/sessionId/type_index_timestamp.jpg
        const timestamp = Date.now();
        const fileName = `${captureType}_${photoIndex}_${timestamp}.jpg`;
        const filePath = `${nickname}/${sessionId}/${fileName}`;

        // Upload to Storage
        const { error: uploadError } = await supabase.storage
            .from('live-photos')
            .upload(filePath, blob, {
                contentType: 'image/jpeg',
                upsert: false
            });

        if (uploadError) {
            console.warn('[LivePhoto] Upload failed:', uploadError.message);
            return null;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('live-photos')
            .getPublicUrl(filePath);

        // Save record to database
        const { error: dbError } = await supabase
            .from('live_photo_captures')
            .insert({
                nickname,
                image_url: publicUrl,
                capture_type: captureType,
                session_id: sessionId,
                photo_index: photoIndex
            });

        if (dbError) {
            console.warn('[LivePhoto] Database insert failed:', dbError.message);
            // Image is still uploaded, just not tracked in DB
        }

        console.log(`[LivePhoto] Stored ${captureType} photo ${photoIndex} for ${nickname}`);
        return publicUrl;
    } catch (err) {
        console.warn('[LivePhoto] Unexpected error:', err.message);
        return null;
    }
};
