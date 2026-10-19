import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { AcademyWorkspace } from '@/components/academy-workspace/workspace';
export const metadata={title:'Academy workspace'};
export default async function Page(){
 const {profile}=await requireSession();
 if(!profile.academy_id||!profile.is_active)redirect('/dashboard');
 const {data,error}=await createClient().rpc('academy_can',{p_academy:profile.academy_id,p_capability:'read'});
 if(error)throw new Error('Could not verify academy workspace access');
 if(!data)redirect('/dashboard');
 return <AcademyWorkspace/>;
}
