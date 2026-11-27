import { env } from 'cloudflare:workers';
import { handleRayAPI } from '../../../../../server/preset-api.mjs';
export const dynamic='force-dynamic';
export const GET=async(request:Request)=>handleRayAPI(request,env);
export const POST=async(request:Request)=>handleRayAPI(request,env);
