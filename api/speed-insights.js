/**
 * Vercel Speed Insights Configuration
 * 
 * Speed Insights is installed and ready to use when serving HTML content.
 * This module provides utilities for integrating Speed Insights into HTML responses.
 * 
 * Note: Speed Insights tracks Core Web Vitals which are browser-based performance metrics.
 * Since this is primarily an API backend serving JSON, Speed Insights will only be active
 * if/when HTML pages are served.
 * 
 * For more information: https://vercel.com/docs/speed-insights/quickstart
 */

import { injectSpeedInsights } from '@vercel/speed-insights';

/**
 * Configuration options for Speed Insights
 */
const speedInsightsConfig = {
    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',
    
    // Sample rate: 1.0 = 100% of events (adjust to reduce data collection)
    sampleRate: 1.0,
    
    // Optional: Filter or modify events before sending
    beforeSend: (event) => {
        // You can modify the event here or return null to prevent sending
        return event;
    }
};

/**
 * Injects Speed Insights script into HTML responses
 * 
 * @example
 * // When serving HTML:
 * import { getSpeedInsightsScript } from './speed-insights.js';
 * 
 * app.get('/dashboard', (req, res) => {
 *   const speedInsightsScript = getSpeedInsightsScript();
 *   res.send(`
 *     <!DOCTYPE html>
 *     <html>
 *       <head>${speedInsightsScript}</head>
 *       <body>...</body>
 *     </html>
 *   `);
 * });
 */
export function getSpeedInsightsScript() {
    // This would typically be used in server-side rendered HTML
    // For now, it's a placeholder for future use
    const result = injectSpeedInsights(speedInsightsConfig);
    return result;
}

/**
 * Middleware to add Speed Insights to HTML responses (if applicable)
 * This is a placeholder for future HTML endpoint integration
 */
export function speedInsightsMiddleware(req, res, next) {
    // Store original res.send
    const originalSend = res.send;
    
    // Override res.send
    res.send = function(data) {
        // Check if response is HTML
        const contentType = res.get('Content-Type');
        if (contentType && contentType.includes('text/html') && typeof data === 'string') {
            // Inject Speed Insights script into HTML
            // This is a basic implementation - adjust based on your needs
            const scriptTag = '<script defer src="/_vercel/speed-insights/script.js"></script>';
            if (data.includes('</head>')) {
                data = data.replace('</head>', `${scriptTag}</head>`);
            } else if (data.includes('</body>')) {
                data = data.replace('</body>', `${scriptTag}</body>`);
            }
        }
        
        // Call original send
        originalSend.call(this, data);
    };
    
    next();
}

export default {
    getSpeedInsightsScript,
    speedInsightsMiddleware,
    config: speedInsightsConfig
};
