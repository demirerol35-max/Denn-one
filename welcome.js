/* Deen One — optional on-device profile, not a server account. */
(()=>{
 const root=document.getElementById('deen-welcome');if(!root)return;
 const heading=root.querySelector('#deen-welcome-title');
 const wish=root.querySelector('#deen-welcome-wish');
 const input=root.querySelector('#deen-profile-name');
 const save=root.querySelector('#deen-profile-save');
 const edit=root.querySelector('#deen-profile-edit');
 const panel=root.querySelector('#deen-profile-panel');
 const notice=root.querySelector('#deen-profile-notice');
 const key='deen-one-local-profile-v1';
 const wishes=['Qu’Allah facilite ta journée 🤲','Que cette journée t’apporte paix et sérénité 🌿','Qu’Allah bénisse tes efforts aujourd’hui 🤲','Une nouvelle journée pour apprendre et faire le bien ✨','Que la paix accompagne tes pas aujourd’hui 🌙'];
 function getName(){try{return JSON.parse(localStorage.getItem(key)||'{}').name||'';}catch(_){return '';}}
 function render(){const name=getName();heading.textContent=name?'Salam Aleykoum '+name+' !':'Salam Aleykoum !';
  const day=Math.floor(Date.now()/86400000);wish.textContent=wishes[day%wishes.length];
  edit.textContent=name?'Modifier mon prénom':'Ajouter mon prénom';panel.hidden=!!name;input.value=name;
 }
 edit.addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)input.focus();});
 save.addEventListener('click',()=>{const name=input.value.trim().replace(/\\s+/g,' ').slice(0,40);
  if(!name){notice.textContent='Indique un prénom.';return;}
  try{localStorage.setItem(key,JSON.stringify({name}));notice.textContent='Prénom enregistré sur cet appareil.';render();}
  catch(_){notice.textContent='Impossible d’enregistrer sur cet appareil.';}
 });
 render();
})();
