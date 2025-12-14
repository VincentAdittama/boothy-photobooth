import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: Keep-Alive Ping for Supabase
 * 
 * This function runs on a schedule (every 2 days) to prevent the Supabase
 * free tier from pausing due to inactivity (7-day rule).
 * 
 * Features:
 * - Retry logic with exponential backoff (3 attempts)
 * - Fallback tables if primary query fails
 * - Comprehensive error logging
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Base delay, doubles each retry

// Tables to try querying (fallbacks if one fails)
const TABLES_TO_PING = ['uploads', 'live_photo_captures'];

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Attempt to ping a specific table
 */
async function pingTable(supabase, tableName) {
    const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);

    if (error) {
        throw new Error(`Table '${tableName}': ${error.message}`);
    }

    return { table: tableName, rows: data?.length ?? 0 };
}

/**
 * Attempt ping with retries and fallback tables
 */
async function pingWithRetry(supabase) {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Try each table as fallback
        for (const table of TABLES_TO_PING) {
            try {
                const result = await pingTable(supabase, table);
                console.log(`[Keep-Alive] Success on attempt ${attempt}, table: ${table}`);
                return { success: true, attempt, ...result };
            } catch (err) {
                lastError = err;
                console.warn(`[Keep-Alive] Attempt ${attempt}, table ${table} failed:`, err.message);
            }
        }

        // Wait before retry (exponential backoff)
        if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`[Keep-Alive] Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }

    return { success: false, error: lastError?.message || 'All retries exhausted' };
}

export default async function handler(req, res) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const timestamp = new Date().toISOString();

    // Validate environment variables
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('[Keep-Alive] Missing Supabase credentials');
        return res.status(500).json({
            status: 'error',
            message: 'Supabase credentials not configured',
            timestamp
        });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Ping with retry logic
        const result = await pingWithRetry(supabase);

        if (result.success) {
            console.log('[Keep-Alive] Ping successful at', timestamp);
            return res.status(200).json({
                status: 'ok',
                message: 'Supabase keep-alive ping successful',
                table: result.table,
                attempt: result.attempt,
                rowsChecked: result.rows,
                timestamp
            });
        } else {
            console.error('[Keep-Alive] All retries failed:', result.error);
            return res.status(500).json({
                status: 'error',
                message: `All ${MAX_RETRIES} retry attempts failed`,
                lastError: result.error,
                timestamp
            });
        }
    } catch (err) {
        console.error('[Keep-Alive] Unexpected error:', err.message);
        return res.status(500).json({
            status: 'error',
            message: err.message,
            timestamp
        });
    }
}
