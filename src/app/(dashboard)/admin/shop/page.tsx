import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/platform-admin';
import { ShopAdmin } from '@/components/shop/shop-admin';
export const metadata={title:'Shop management'};
export default async function Page(){const {data:{user}}=await createClient().auth.getUser();if(!isPlatformAdmin(user))redirect('/dashboard');return <ShopAdmin/>}
