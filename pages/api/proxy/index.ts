import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';

const acceptedDomains = [
    'lastfm.freetls.fastly.net',
    'lastfm-img2.akamaized.net',
    'img2-ssl.lst.fm',
    'secure.gravatar.com',
    'www.gravatar.com',
];

/**
 * "Proxy" endpoint that takes a Last.fm cover art URL and returns its base64 representation. Cover art images are
 * inlined into the final SVG because GitHub's Content Security Policy prohibits external images.
 */
export default async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const { img } = req.query;

    if (!img || Array.isArray(img)) {
        res.statusCode = 400;
        res.json({ error: 'Invalid img parameter: Must be a single URL' });
        return;
    }

    // Securely validate the URL hostname
    try {
        const parsedUrl = new URL(img);
        const isAccepted = acceptedDomains.includes(parsedUrl.hostname);
        if (!isAccepted) {
            res.statusCode = 400;
            res.json({ error: 'Invalid img parameter: Domain not allowed' });
            return;
        }
    } catch {
        res.statusCode = 400;
        res.json({ error: 'Invalid img parameter: Malformed URL' });
        return;
    }

    try {
        const { data } = await axios.get<ArrayBuffer>(img, {
            responseType: 'arraybuffer',
        });
        const base64 = Buffer.from(data).toString('base64');

        // Set cache for a week
        res.setHeader('Cache-Control', 'max-age=86400, immutable');
        res.send(`data:image/png;base64,${base64}`);
    } catch (e: unknown) {
        res.statusCode = 400;
        if (axios.isAxiosError(e)) {
            const data = e.response?.data;
            if (data && typeof data === 'object' && 'message' in data) {
                res.json({ error: (data as { message: string }).message });
            } else {
                res.json({ error: e.message });
            }
        } else if (e instanceof Error) {
            res.json({ error: e.message });
        } else {
            res.json({ error: 'An unknown error occurred' });
        }
    }
};
