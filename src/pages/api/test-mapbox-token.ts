import type { APIRoute } from 'astro';
import { getEnvVar } from '../../lib/env/cloudflare';

export const GET: APIRoute = async ({ request }) => {
  const token = getEnvVar('VITE_MAPBOX_ACCESS_TOKEN') || 
                getEnvVar('PUBLIC_MAPBOX_ACCESS_TOKEN') || 
                import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 
                import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN || 
                process.env.VITE_MAPBOX_ACCESS_TOKEN ||
                process.env.PUBLIC_MAPBOX_ACCESS_TOKEN ||
                '';
  
  const hasToken = !!token;
  const tokenLength = token.length;
  const startsWithPk = token.startsWith('pk.');
  
  return new Response(JSON.stringify({
    hasToken,
    tokenLength,
    startsWithPk,
    tokenPreview: hasToken ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}` : 'No token found',
    sources: {
      getEnvVite: !!getEnvVar('VITE_MAPBOX_ACCESS_TOKEN'),
      getEnvPublic: !!getEnvVar('PUBLIC_MAPBOX_ACCESS_TOKEN'),
      importMetaVite: !!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
      importMetaPublic: !!import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN,
      processVite: !!(typeof process !== 'undefined' && process.env?.VITE_MAPBOX_ACCESS_TOKEN),
      processPublic: !!(typeof process !== 'undefined' && process.env?.PUBLIC_MAPBOX_ACCESS_TOKEN)
    }
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};