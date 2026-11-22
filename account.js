/* Optional Supabase cloud accounts. Leave empty until project is configured. */
(()=>{
 const SUPABASE_URL='';
 const SUPABASE_PUBLISHABLE_KEY='';
 const root=document.getElementById('deen-account');if(!root)return;
 const email=root.querySelector('#deen-account-email'), password=root.querySelector('#deen-account-password');
 const status=root.querySelector('#deen-account-status');
 const signIn=root.querySelector('#deen-account-signin'),signUp=root.querySelector('#deen-account-signup'),signOut=root.querySelector('#deen-account-signout');
 const cloudConfigured=!!(SUPABASE_URL&&SUPABASE_PUBLISHABLE_KEY);
 let client=null,user=null;
 const show=(msg)=>{status.textContent=msg;};
 if(!cloudConfigured){show('Compte synchronisé en préparation. Ton prénom reste enregistré sur cet appareil.');signIn.disabled=true;signUp.disabled=true;signOut.hidden=true;return;}
 async function init(){
  try{
   const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
   client=sdk.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
   const {data,error}=await client.auth.getUser();if(error)throw error;
   user=data.user;render();
   client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;render();});
  }catch(_){show('Connexion au service de comptes indisponible.');}
 }
 function render(){signOut.hidden=!user;signIn.hidden=!!user;signUp.hidden=!!user;
  show(user?'Connecté : '+user.email:'Connecte-toi ou crée un compte pour synchroniser ton profil.');
  if(user)syncName();
 }
 async function syncName(){
  if(!user||!client)return;
  const local=JSON.parse(localStorage.getItem('deen-one-local-profile-v1')||'{}').name||'';
  const {data}=await client.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
  if(data?.display_name){localStorage.setItem('deen-one-local-profile-v1',JSON.stringify({name:data.display_name}));window.dispatchEvent(new Event('deen-profile-updated'));}
  else if(local)await client.from('profiles').upsert({id:user.id,display_name:local,updated_at:new Date().toISOString()});
 }
 window.deenCloud={
  async saveName(name){if(!client||!user)return;await client.from('profiles').upsert({id:user.id,display_name:name,updated_at:new Date().toISOString()});},
  async saveProgress(key,value){if(!client||!user)return false;const {error}=await client.from('user_progress').upsert({user_id:user.id,progress_key:key,progress_value:value,updated_at:new Date().toISOString()});return !error;},
  async loadProgress(key){if(!client||!user)return null;const {data}=await client.from('user_progress').select('progress_value').eq('user_id',user.id).eq('progress_key',key).maybeSingle();return data?.progress_value||null;},
  async suggest(name,location,address){if(!client||!user)return {ok:false,error:'Connecte-toi pour envoyer la proposition.'};const {error}=await client.from('mosque_suggestions').insert({user_id:user.id,name,location_input:location,address});return {ok:!error,error:error?.message};}
 };
 async function authenticate(register){
  if(!client)return;const e=email.value.trim(),p=password.value;
  if(!e.includes('@')||p.length<8){show('Indique un e-mail valide et un mot de passe de 8 caractères minimum.');return;}
  show('Connexion en cours…');
  const {error}=register?await client.auth.signUp({email:e,password:p}):await client.auth.signInWithPassword({email:e,password:p});
  if(error)show('Connexion impossible : '+error.message);
  else if(register)show('Vérifie ton e-mail pour confirmer la création du compte.');
 }
 signIn.addEventListener('click',()=>authenticate(false));
 signUp.addEventListener('click',()=>authenticate(true));
 signOut.addEventListener('click',async()=>{if(client)await client.auth.signOut();});
 init();
})();
