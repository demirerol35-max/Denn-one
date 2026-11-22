/* Optional Supabase cloud accounts. Leave empty until project is configured. */
(()=>{
 const SUPABASE_URL='';
 const SUPABASE_PUBLISHABLE_KEY='';
 const root=document.getElementById('deen-account');if(!root)return;
 const email=root.querySelector('#deen-account-email'), password=root.querySelector('#deen-account-password');
 const status=root.querySelector('#deen-account-status');
 const google=root.querySelector('#deen-account-google');
 const signIn=root.querySelector('#deen-account-signin'),signUp=root.querySelector('#deen-account-signup'),signOut=root.querySelector('#deen-account-signout');
 const reset=root.querySelector('#deen-account-reset');
 const toggle=root.querySelector('#deen-account-password-toggle');
 if(toggle)toggle.addEventListener('click',()=>{const visible=password.type==='password';password.type=visible?'text':'password';toggle.textContent=visible?'Masquer le mot de passe':'Afficher le mot de passe';toggle.setAttribute('aria-pressed',String(visible));});
 let recovering=false;
 const cloudConfigured=!!(SUPABASE_URL&&SUPABASE_PUBLISHABLE_KEY);
 const profileOwnerKey='deen-one-profile-owner-v1';
 let syncInFlight=false;
 let client=null,user=null;
 const show=(msg)=>{status.textContent=msg;};
 if(!cloudConfigured){show('Compte synchronisé en préparation. Ton prénom reste enregistré sur cet appareil.');signIn.disabled=true;signUp.disabled=true;if(google)google.disabled=true;if(reset)reset.disabled=true;email.disabled=true;password.disabled=true;signOut.hidden=true;return;}
 async function init(){
  try{
   const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
   client=sdk.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
   const {data}=await client.auth.getSession();
   user=data.session?.user||null;if(user)switchProfile(null,user.id);render();
   client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){recovering=true;password.disabled=false;password.value='';show('Choisis un nouveau mot de passe (8 caractères minimum), puis confirme.');}const previous=user?.id;user=session?.user||null;if(previous!==user?.id){switchProfile(previous,user?.id);}render();});
  }catch(_){show('Connexion au service de comptes indisponible.');}
 }
 function switchProfile(previous,next){
  try{const storedOwner=localStorage.getItem(profileOwnerKey);
   if((storedOwner && storedOwner!==next)||(previous && previous!==next))localStorage.removeItem('deen-one-local-profile-v1');
   if(next)localStorage.setItem(profileOwnerKey,next);else localStorage.removeItem(profileOwnerKey);
  }catch(_){}window.dispatchEvent(new Event('deen-profile-updated'));
 }
 function render(){if(recovering){signOut.hidden=false;signIn.hidden=true;signUp.hidden=true;if(google)google.hidden=true;if(reset){reset.hidden=false;reset.textContent='Confirmer le nouveau mot de passe';}return;}signOut.hidden=!user;signIn.hidden=!!user;signUp.hidden=!!user;if(reset)reset.hidden=!!user;if(google)google.hidden=!!user;
  show(user?'Connecté : '+user.email:'Connecte-toi ou crée un compte pour synchroniser ton profil.');
  if(user)syncName().catch(()=>show('Connecté, mais la synchronisation du profil est indisponible.'));
 }
 async function syncName(){
  if(!user||!client||syncInFlight)return;
  syncInFlight=true;const owner=user.id;
  try{
  let local='';try{local=JSON.parse(localStorage.getItem('deen-one-local-profile-v1')||'{}').name||'';}catch(_){}
  const {data}=await client.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
  if(user?.id!==owner)return;
  if(data?.display_name && user){localStorage.setItem('deen-one-local-profile-v1',JSON.stringify({name:data.display_name}));window.dispatchEvent(new Event('deen-profile-updated'));}
  else if(local && user)await client.from('profiles').upsert({id:user.id,display_name:local,updated_at:new Date().toISOString()});
  }finally{syncInFlight=false;}
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
 if(google)google.addEventListener('click',async()=>{
  if(!client)return;
  show('Ouverture de la connexion Google…');
  const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});
  if(error)show('Connexion Google indisponible : '+error.message);
 });
 if(reset)reset.addEventListener('click',async()=>{
  if(!client)return;
  if(recovering){if(password.value.length<8){show('Le nouveau mot de passe doit contenir au moins 8 caractères.');return;}
    const {error}=await client.auth.updateUser({password:password.value});
    if(error){show('Modification impossible : '+error.message);return;}
    password.value='';recovering=false;reset.textContent='Mot de passe oublié ?';render();show('Ton mot de passe a été modifié.');return;
  }const e=email.value.trim();if(!e.includes('@')){show('Indique ton adresse e-mail pour recevoir un lien de réinitialisation.');return;}
  const {error}=await client.auth.resetPasswordForEmail(e,{redirectTo:window.location.origin+window.location.pathname});
  show(error?'Impossible de demander la réinitialisation pour le moment.':'Si cette adresse est enregistrée, un e-mail de réinitialisation sera envoyé.');
 });
 signIn.addEventListener('click',()=>authenticate(false));
 signUp.addEventListener('click',()=>authenticate(true));
 signOut.addEventListener('click',async()=>{if(client)await client.auth.signOut();});
 init();
})();
