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
