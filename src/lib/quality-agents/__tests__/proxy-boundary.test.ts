import {describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('next-auth',()=>({default:()=>({auth:(callback:unknown)=>callback})}));
vi.mock('@/lib/auth.config',()=>({default:{}}));
import proxy from '@/proxy';
function invoke(path:string){const req=new NextRequest('https://example.test'+path);Object.defineProperty(req,'auth',{value:null});return (proxy as unknown as (request:NextRequest)=>Response)(req)}
describe('quality service versus browser authentication boundary',()=>{
 it('allows the exact bearer-authenticated route to perform its own JSON auth check',()=>expect(invoke('/api/internal/quality-incidents').headers.get('x-middleware-next')).toBe('1'));
 it('does not make other internal or customer routes public',()=>{
  for(const path of ['/api/internal/quality-incidents/anything','/api/internal/something','/clients'])expect(invoke(path).headers.get('location')).toContain('/login');
 });
});
