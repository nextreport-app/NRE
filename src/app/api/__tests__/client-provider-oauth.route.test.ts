import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const m=vi.hoisted(()=>({auth:vi.fn(),exchange:vi.fn(),profile:vi.fn(),email:vi.fn(),advertisers:vi.fn(),user:vi.fn(),upsert:vi.fn(),find:vi.fn(),owned:vi.fn(),update:vi.fn(),clear:vi.fn(),tx:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));
vi.mock("@/lib/prisma",()=>({prisma:{user:{update:m.user},client:{findFirst:m.find,updateMany:m.owned,update:m.update},clientProviderConnection:{upsert:m.upsert},websiteDashboardSnapshot:{deleteMany:m.clear},$transaction:m.tx}}));
vi.mock("@/lib/ga4-api",()=>({GA4_OAUTH_STATE_COOKIE:"ga4-state",exchangeGa4AuthCode:m.exchange,fetchGa4AccountEmail:m.email}));
vi.mock("@/lib/google-ads-api",()=>({GOOGLE_ADS_OAUTH_STATE_COOKIE:"ads-state",exchangeGoogleAdsAuthCode:m.exchange,fetchGoogleAdsAccountEmail:m.email}));
vi.mock("@/lib/google-drive",()=>({GOOGLE_DRIVE_OAUTH_STATE_COOKIE:"drive-state",exchangeGoogleAuthCode:m.exchange,fetchGoogleAccountEmail:m.email}));
vi.mock("@/lib/meta-api",()=>({META_OAUTH_STATE_COOKIE:"meta-state",exchangeMetaAuthCode:m.exchange,exchangeForLongLivedToken:m.exchange,fetchMetaUserProfile:m.profile}));
vi.mock("@/lib/tiktok-api",()=>({TIKTOK_OAUTH_STATE_COOKIE:"tiktok-state",exchangeTikTokAuthCode:m.exchange,fetchTikTokAdvertisers:m.advertisers}));
import {prisma} from "@/lib/prisma";
import {GET as ga4} from "../ga4/callback/route";
import {GET as meta} from "../meta/callback/route";
import {GET as ads} from "../google-ads/callback/route";
import {GET as drive} from "../google-drive/callback/route";
import {GET as tiktok} from "../tiktok/callback/route";
import {bindProviderOAuth,providerScopeCookie} from "@/lib/client-provider-oauth";
import type {ClientProvider} from "@/lib/client-provider-connections";
const cases:[ClientProvider, typeof ga4,string][]=[["ga4",ga4,"ga4-state"],["meta",meta,"meta-state"],["google-ads",ads,"ads-state"],["google-drive",drive,"drive-state"],["tiktok",tiktok,"tiktok-state"]];
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("AUTH_SECRET","provider-callback-test-encryption-key-12345678");m.auth.mockResolvedValue({user:{id:"owner"}});m.exchange.mockResolvedValue({access_token:"private-access",refresh_token:"private-refresh"});m.profile.mockResolvedValue({id:"meta-profile",name:"Client profile"});m.email.mockResolvedValue("client@example.test");m.advertisers.mockResolvedValue([]);m.find.mockResolvedValue({id:"client-a"});m.owned.mockResolvedValue({count:1});m.tx.mockImplementation(async (fn:(tx:typeof prisma)=>unknown)=>fn(prisma));});
async function request(provider:ClientProvider,stateCookie:string,scope="client-a"){
 const start=await bindProviderOAuth(new NextRequest(`https://app.test/api/${provider}/connect${scope?`?clientId=${scope}`:""}`),NextResponse.redirect("https://provider.test"),provider,"owner","nonce");
 return new NextRequest(`https://app.test/api/${provider}/callback?state=nonce&code=code`,{headers:{cookie:`${stateCookie}=nonce; ${stateCookie}_pkce=owner:verifier; ${providerScopeCookie(provider)}=${start.cookies.get(providerScopeCookie(provider))!.value}`}});
}
it.each(cases)("completes the %s callback only for its initiating client",async(provider,callback,cookie)=>{
 const response=await callback(await request(provider,cookie));
 const destination=new URL(response.headers.get("location")!);
 expect(destination.pathname).toBe("/clients/client-a");
 expect(destination.hash).toBe(provider==="ga4"?"#website-analytics":"#provider-connections");
 expect(m.upsert).toHaveBeenCalledOnce();expect(m.user).not.toHaveBeenCalled();
 expect(JSON.stringify(m.upsert.mock.calls[0])).not.toContain("private-access");
 expect(response.headers.get("set-cookie")).toContain(`${providerScopeCookie(provider)}=`);
});
it.each(cases)("keeps the existing agency %s callback working when started without a client",async(provider,callback,cookie)=>{
 const response=await callback(await request(provider,cookie,""));
 expect(new URL(response.headers.get("location")!).pathname).toBe("/account");
 expect(m.user).toHaveBeenCalledOnce();expect(m.upsert).not.toHaveBeenCalled();
 if(provider==="google-drive")expect(m.owned).toHaveBeenCalledWith({where:{userId:"owner",providerConnections:{none:{provider:"google-drive"}}},data:{lastDriveFolderId:null,lastDriveFolderName:null}});
});
it.each(cases)("rejects a %s callback after the signed-in owner changes before exchanging a code",async(provider,callback,cookie)=>{
 const req=await request(provider,cookie);m.auth.mockResolvedValue({user:{id:"other"}});
 const response=await callback(req);
 expect(new URL(response.headers.get("location")!).search).toContain("error=");
 expect(m.exchange).not.toHaveBeenCalled();expect(m.user).not.toHaveBeenCalled();expect(m.upsert).not.toHaveBeenCalled();
});
