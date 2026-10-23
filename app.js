import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
const $=s=>document.querySelector(s);
const region=$('#canvas-wrap'),story=$('.assembly'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const bucketStages=[
 ['ЛИСТ / ФОРМОВКА','Основа прочности.','Всё начинается с листа. Прокрутите страницу, чтобы собрать конструкцию.'],
 ['ЛИСТ / БОКОВИНЫ','Защита по краям.','Две боковые стенки замыкают корпус и формируют рабочий объём ковша.'],
 ['ЛИСТ / ЗАЩИТА','Там, где выше износ.','Накладки усиливают зоны контакта с абразивом на наружной поверхности.'],
 ['УЗЕЛ / КРЕПЛЕНИЕ','Связь с машиной.','Поперечная балка и проушины образуют верхний узел крепления.'],
 ['ЛИСТ / КРОМКА','Первая линия контакта.','Основание режущей части соединяет корпус с рабочими элементами.'],
 ['УЗЕЛ / ЗУБЬЯ','Каждая деталь на месте.','Пять зубьев завершают сборку. Конструкция готова к тяжёлой работе.']
];
const truckStages=[['ЛИСТ / ДНИЩЕ','Основа кузова.','Несущий лист днища принимает нагрузку от перевозимой породы.'],['ЛИСТ / БОРТА','Объём для тяжёлого груза.','Два наклонных борта формируют рабочее пространство кузова.'],['ЛИСТ / ПЕРЕДНЯЯ СТЕНКА','Защита фронтальной зоны.','Передняя стенка замыкает кузов со стороны кабины.'],['УЗЕЛ / ПОДРАМНИК','Опора всей конструкции.','Продольные балки, поперечины и шарнирные узлы располагаются под днищем.'],['ЛИСТ / КОЗЫРЁК','Защита над кабиной.','Передний козырёк завершает верхнюю часть кузова.'],['ЛИСТ / ФУТЕРОВКА','Защита рабочих поверхностей.','Сменные износостойкие панели устанавливаются на днище и передней стенке.']];
let stages=bucketStages,activeEquipment='bucket',models={},baseScale=1;
function lightTheme(){return document.documentElement.dataset.theme==='light'}
function syncTheme(){const light=lightTheme();$('#theme-toggle').setAttribute('aria-label',light?'Включить тёмную тему':'Включить светлую тему');$('#theme-toggle').innerHTML='<span aria-hidden="true">'+(light?'☾':'☼')+'</span><span class="theme-label">'+(light?'Тёмная':'Светлая')+'</span>';if(renderer)renderer.toneMappingExposure=light?1.12:1.05;for(const m of meshList){m.userData.blueprintMaterial.color.set(light?0xd7e1e6:0x172126);m.userData.edges.material.color.set(light?0x476578:0x91aebb)}needsRender=true;}
$('#theme-toggle').addEventListener('click',()=>{document.documentElement.dataset.theme=lightTheme()?'dark':'light';try{localStorage.setItem('rexard-theme',document.documentElement.dataset.theme)}catch{}syncTheme()});
let rawProgress=0,visualProgress=0,model,groups=[],meshList=[],wire=false,controls,renderer,scene,camera,needsRender=true,isVisible=true;
const clamp=n=>Math.min(1,Math.max(0,n));
function progress(){const b=story.getBoundingClientRect();rawProgress=clamp(-b.top/(story.offsetHeight-innerHeight));needsRender=true;}
function goTo(p){const top=story.getBoundingClientRect().top+scrollY;scrollTo({top:top+p*(story.offsetHeight-innerHeight),behavior:reduced.matches?'instant':'smooth'});}
window.addEventListener('scroll',progress,{passive:true});window.addEventListener('resize',()=>{progress();resize()});
reduced.addEventListener('change',progress);
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>goTo([0,.28,.43,.64,.8,1][Number(button.dataset.step)])));
$('#complete-model').addEventListener('click',()=>goTo(rawProgress>.98?0:1));
let priorStage=-1;
function updateLabels(p){
 const index=p>=.95?5:p>=.72?4:p>=.49?3:p>=.32?2:p>=.15?1:0;
 $('#percent').innerHTML=`${Math.round(p*100)}<span>%</span>`;
 $('#progress-bar').style.width=`${p*100}%`;
 $('#complete-model').innerHTML=(p>.98?'Разобрать модель':'Собрать полностью')+' <span>＋</span>';
 if(index!==priorStage){priorStage=index;$('#step-number').textContent='0'+(index+1);$('#part-code').textContent=stages[index][0];$('#part-name').textContent=stages[index][1];$('#part-desc').textContent=stages[index][2];document.querySelectorAll('[data-step]').forEach((b,i)=>{b.classList.toggle('active',index===i);b.setAttribute('aria-current',index===i?'step':'false')})}
}
function resize(){if(!renderer)return;const w=region.clientWidth,h=region.clientHeight;renderer.setSize(w,h,false);const aspect=w/h;const size=innerWidth<701?7.1:6.7;camera.left=-size*aspect/2;camera.right=size*aspect/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();needsRender=true;}
function setMode(value){wire=value;meshList.forEach(m=>{m.material=wire?m.userData.blueprintMaterial:m.userData.originalMaterial;m.userData.edges.visible=wire});$('#solid-mode').classList.toggle('selected',!wire);$('#wire-mode').classList.toggle('selected',wire);$('#solid-mode').setAttribute('aria-pressed',String(!wire));$('#wire-mode').setAttribute('aria-pressed',String(wire));needsRender=true;}
$('#solid-mode').addEventListener('click',()=>setMode(false));$('#wire-mode').addEventListener('click',()=>setMode(true));
const offsetMap={
 '01_ROLLED_SHELL':{stage:0,offset:[0,-.05,-.18]},
 '02_LEFT_CHEEK':{stage:1,offset:[-1.1,.15,0]},
 '03_RIGHT_CHEEK':{stage:1,offset:[1.1,.15,0]},
 '04_WEAR_STRIPS':{stage:2,offset:[0,-.5,-.5]},
 '05_CROSS_BEAM':{stage:3,offset:[0,.65,0]},
 '06_ATTACHMENT_EARS':{stage:3,offset:[0,1.2,0]},
 '07_CUTTING_EDGE':{stage:4,offset:[0,-.10,.6]}
};
Object.assign(offsetMap,{'T01_FLOOR':{stage:0,offset:[0,-.22,0]},'T02_LEFT_WALL':{stage:1,offset:[-1.35,.25,0]},'T03_RIGHT_WALL':{stage:1,offset:[1.35,.25,0]},'T04_FRONT_WALL':{stage:2,offset:[0,.2,-1.25]},'T05_UNDERFRAME':{stage:3,offset:[0,-.95,0]},'T06_CANOPY':{stage:4,offset:[0,1.45,0]},'T07_LINERS':{stage:5,offset:[0,1.05,0]}});
for(let i=1;i<=5;i++)offsetMap['08_TOOTH_0'+i]={stage:5,offset:[(i-3)*.1,-.14,.98+Math.abs(i-3)*.08]};
try{
 scene=new THREE.Scene();
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x111315,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.setAttribute('aria-label','Объёмная модель ковша. Перетащите мышью, чтобы повернуть.');renderer.domElement.setAttribute('role','img');region.append(renderer.domElement);
 camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,100);camera.position.set(-5.5,4.1,7.7);
 controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.5,.05);controls.enableZoom=false;controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.09;controls.rotateSpeed=.65;controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI*.66;controls.saveState();controls.addEventListener('change',()=>needsRender=true);
 // Preserve touch page scrolling; orbit on desktop pointer or two-finger mobile gesture.
 controls.touches.ONE=null;controls.touches.TWO=THREE.TOUCH.ROTATE;renderer.domElement.style.touchAction='pan-y';
 $('#reset-view').addEventListener('click',()=>{controls.reset();needsRender=true});
 const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.045).texture;scene.environmentIntensity=.9;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xeef2ff,3.2);key.position.set(-4,6,6);scene.add(key);
 const rim=new THREE.DirectionalLight(0xffd4b5,2.2);rim.position.set(4,5,-3);scene.add(rim);
 const fill=new THREE.DirectionalLight(0xc5d7e9,1.1);fill.position.set(3,1,6);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.11}));floor.rotation.x=-Math.PI/2;floor.position.y=-.65;floor.receiveShadow=true;scene.add(floor);
 const grid=new THREE.GridHelper(13,26,0x394047,0x282f35);grid.position.y=-.65;grid.material.transparent=true;grid.material.opacity=.20;scene.add(grid);
 // Fine floor guide circle, a technical reference rather than a baked shadow image.
 const ring=new THREE.Mesh(new THREE.RingGeometry(2.55,2.557,100),new THREE.MeshBasicMaterial({color:0x626c73,transparent:true,opacity:.17,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.63;scene.add(ring);
 resize();progress();visualProgress=reduced.matches?1:rawProgress;
 const loader=new GLTFLoader();
 const [bucketData,truckData]=await Promise.all([loader.loadAsync('./assets/rexard-bucket.glb'),loader.loadAsync('./assets/rexard-truck-body.glb')]);
 models={bucket:bucketData.scene,truck:truckData.scene};
 for(const [type,asset] of Object.entries(models)){
 scene.add(asset);asset.visible=type==='bucket';asset.userData.parts=[];asset.userData.meshes=[];
 asset.traverse(o=>{
  if(offsetMap[o.name]){const def=offsetMap[o.name];o.position.set(0,0,0);asset.userData.parts.push({object:o,stage:def.stage,offset:new THREE.Vector3(...def.offset)});}
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.envMapIntensity=1.1;o.userData.originalMaterial=o.material;o.userData.blueprintMaterial=new THREE.MeshBasicMaterial({color:0x172126,transparent:true,opacity:.48,depthWrite:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});const geometry=new THREE.EdgesGeometry(o.geometry,27);const edges=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x91aebb,transparent:true,opacity:.8}));edges.visible=false;o.add(edges);o.userData.edges=edges;asset.userData.meshes.push(o)}
 });
 }
 function selectEquipment(type){renderer.domElement.setAttribute('aria-label',type==='bucket'?'Объёмная модель ковша. Перетащите мышью, чтобы повернуть.':'Объёмная модель кузова самосвала. Перетащите мышью, чтобы повернуть.');activeEquipment=type;stages=type==='bucket'?bucketStages:truckStages;model=models[type];Object.entries(models).forEach(([key,asset])=>asset.visible=key===type);groups=model.userData.parts;meshList=model.userData.meshes;baseScale=type==='bucket'?1:.64;priorStage=-1;
 const names=type==='bucket'?['Корпус','Боковины','Защита','Крепление','Кромка','Зубья']:['Днище','Борта','Стенка','Подрамник','Козырёк','Футеровка'];
 document.querySelectorAll('[data-step]').forEach((b,i)=>b.innerHTML='<span>0'+(i+1)+'</span>'+names[i]);$('.label-b b').textContent=type==='bucket'?'РАБОЧАЯ КРОМКА':'ФУТЕРОВКА КУЗОВА';$('#model-caption').textContent=type==='bucket'?'КОВШ / СБОРОЧНАЯ МОДЕЛЬ':'КАРЬЕРНЫЙ КУЗОВ / СБОРОЧНАЯ МОДЕЛЬ';
 $('#select-bucket').classList.toggle('active',type==='bucket');$('#select-truck').classList.toggle('active',type==='truck');$('#select-bucket').setAttribute('aria-pressed',String(type==='bucket'));$('#select-truck').setAttribute('aria-pressed',String(type==='truck'));
 controls.target.set(0,type==='bucket'?1.5:1.05,0);camera.position.set(-5.5,4.1,7.7);controls.saveState();controls.update();setMode(wire);syncTheme();needsRender=true;
 }
 $('#select-bucket').addEventListener('click',()=>selectEquipment('bucket'));$('#select-truck').addEventListener('click',()=>selectEquipment('truck'));
 selectEquipment('bucket');
 $('#model-loader').remove();
 const observer=new IntersectionObserver(entries=>{isVisible=entries[0].isIntersecting;if(isVisible)needsRender=true});observer.observe($('.stage'));
 let last=performance.now();
 function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(!isVisible||document.hidden)return;
 const target=reduced.matches?1:rawProgress;const difference=target-visualProgress;
 if(Math.abs(difference)>.0002){visualProgress+=difference*(1-Math.exp(-dt*10));needsRender=true;}else visualProgress=target;
 controls.update();if(!needsRender)return;needsRender=false;
 const p=visualProgress;
 groups.forEach(({object,stage,offset})=>{const starts=[0,.10,.26,.42,.66,.81],ends=[.12,.32,.46,.71,.85,.98];let t=clamp((p-starts[stage])/(ends[stage]-starts[stage]));t=t*t*(3-2*t);object.position.copy(offset).multiplyScalar(1-t);});
 // The finished object occupies more of the viewport as the assembly closes.
 model.scale.setScalar(baseScale*(.93+p*.15));model.position.y=-p*.12;
 updateLabels(p);
 const a=new THREE.Vector3(-1.5,1.18,.05).applyMatrix4(model.matrixWorld).project(camera);const b=new THREE.Vector3(.8,.06,2.05).applyMatrix4(model.matrixWorld).project(camera);
 [['.label-a',a],['.label-b',b]].forEach(([selector,v])=>{const el=$(selector);el.style.left=`${(v.x*.5+.5)*region.clientWidth+15}px`;el.style.top=`${(-v.y*.5+.5)*region.clientHeight}px`;el.style.opacity=p>.97&&wire?'1':'0'});
 renderer.render(scene,camera);
 }
 requestAnimationFrame(tick);
}catch(error){console.error(error);$('#model-loader').textContent='Не удалось загрузить 3D-модель. Обновите страницу.';}
const template='Запрос на подбор стали REXARD / ЕМК\nОборудование и деталь:\nРабочая среда:\nТип нагрузки:\nТолщина и размеры листа:\nОбъём:\nЧертёж или эскиз:';
$('#copy-request').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(template);$('#copy-status').textContent='Шаблон скопирован. Заполните его и передайте менеджеру ЕМК.'}catch{$('#request-fallback').hidden=false;$('#request-fallback').value=template;$('#copy-status').textContent='Скопируйте шаблон из поля ниже.'}});
document.querySelectorAll('.application-list details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)document.querySelectorAll('.application-list details').forEach(other=>{if(other!==detail)other.open=false})}));

const gradeInfo={
 '450':{thickness:'4–100',tensile:'1250',yield:'1050',impact:'24',temp:'−20',purpose:'Баланс твёрдости и обрабатываемости для общетехнических задач.'},
 '500':{thickness:'4–100',tensile:'1350',yield:'1150',impact:'21',temp:'−20',purpose:'Повышенная твёрдость для рабочих поверхностей с интенсивным абразивным износом.'},
 '450L':{thickness:'6–50',tensile:'1250',yield:'1050',impact:'27',temp:'−40',purpose:'Низкотемпературное исполнение REXARD 450.'},
 '500L':{thickness:'6–50',tensile:'1350',yield:'1150',impact:'27',temp:'−40',purpose:'Низкотемпературное исполнение REXARD 500.'}
};
document.querySelectorAll('[data-grade]').forEach(button=>button.addEventListener('click',()=>{const g=gradeInfo[button.dataset.grade];document.querySelectorAll('[data-grade]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});$('#grade-title').textContent='REXARD '+button.dataset.grade;$('#grade-purpose').textContent=g.purpose;$('#grade-thickness').innerHTML=g.thickness+' <small>мм</small>';$('#grade-tensile').innerHTML=g.tensile+' <small>МПа</small>';$('#grade-yield').innerHTML=g.yield+' <small>МПа</small>';$('#grade-impact').innerHTML=g.impact+' <small>Дж / '+g.temp+' °C</small>'}));
