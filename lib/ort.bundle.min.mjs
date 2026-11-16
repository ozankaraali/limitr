/*!
 * ONNX Runtime Web v1.31.1
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
var eo=Object.defineProperty;var Kf=Object.getOwnPropertyDescriptor;var jf=Object.getOwnPropertyNames;var Zf=Object.prototype.hasOwnProperty;var to=(t=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(t,{get:(e,r)=>(typeof require<"u"?require:e)[r]}):t)(function(t){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+t+'" is not supported')});var V=(t,e,r)=>()=>{if(r)throw r[0];try{return t&&(e=t(t=0)),e}catch(n){throw r=[n],n}};var Ht=(t,e)=>{for(var r in e)eo(t,r,{get:e[r],enumerable:!0})},Qf=(t,e,r,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of jf(e))!Zf.call(t,o)&&o!==r&&eo(t,o,{get:()=>e[o],enumerable:!(n=Kf(e,o))||n.enumerable});return t};var ar=t=>Qf(eo({},"__esModule",{value:!0}),t);var sr,vt,Ha,Dt,Fa,qa,Ka,Pr=V(()=>{"use strict";sr=new Map,vt=[],Ha=new WeakMap,Dt=(t,e,r)=>{if(e&&typeof e.init=="function"&&typeof e.createInferenceSessionHandler=="function"){let n=sr.get(t);if(n===void 0)sr.set(t,{backend:e,priority:r});else{if(n.priority>r)return;if(n.priority===r&&n.backend!==e)throw new Error(`cannot register backend "${t}" using priority ${r}`)}if(r>=0){let o=vt.indexOf(t);o!==-1&&vt.splice(o,1);for(let i=0;i<vt.length;i++)if(sr.get(vt[i]).priority<=r){vt.splice(i,0,t);return}vt.push(t)}return}throw new TypeError("not a valid backend")},Fa=async t=>{let e=sr.get(t);if(!e)return"backend not found.";if(e.initialized)return e.backend;if(e.aborted)return e.error;{let r=!!e.initPromise;try{if(!r){let n=e.backend,o=Ha.get(n);e.initPromise=o?o.then(async()=>n.init(t),async()=>n.init(t)):n.init(t),Ha.set(n,e.initPromise)}return await e.initPromise,e.initialized=!0,e.backend}catch(n){return r||(e.error=`${n}`,e.aborted=!0),e.error}finally{delete e.initPromise}}},qa=async t=>{let e=t.executionProviders||[],r=e.map(d=>typeof d=="string"?d:d.name),n=r.length===0?vt:r,o,i=[],u=new Set;for(let d of n){let c=await Fa(d);typeof c=="string"?i.push({name:d,err:c}):(o||(o=c),o===c&&u.add(d))}if(!o)throw new Error(`no available backend found. ERR: ${i.map(d=>`[${d.name}] ${d.err}`).join(", ")}`);for(let{name:d,err:c}of i)r.includes(d)&&console.warn(`removing requested execution provider "${d}" from session options because it is not available: ${c}`);let s=e.filter(d=>u.has(typeof d=="string"?d:d.name));return[o,new Proxy(t,{get:(d,c)=>c==="executionProviders"?s:Reflect.get(d,c)})]},Ka=async()=>{let t=[];for(let r of vt){if(typeof sr.get(r).backend.createLoraAdapterHandler!="function")continue;let n=await Fa(r);if(typeof n!="string")return n;t.push({name:r,err:n})}let e=t.length===0?"":` ERR: ${t.map(r=>`[${r.name}] ${r.err}`).join(", ")}`;throw new Error(`no available backend supports LoRA adapters.${e}`)}});var ja=V(()=>{"use strict";Pr()});var Za,Qa=V(()=>{"use strict";Za="1.31.1"});var Ya,Be,ro=V(()=>{"use strict";Qa();Ya="warning",Be={wasm:{},webgl:{},webgpu:{},versions:{common:Za},set logLevel(t){if(t!==void 0){if(typeof t!="string"||["verbose","info","warning","error","fatal"].indexOf(t)===-1)throw new Error(`Unsupported logging level: ${t}`);Ya=t}},get logLevel(){return Ya}};Object.defineProperty(Be,"logLevel",{enumerable:!0})});var ve,Xa=V(()=>{"use strict";ro();ve=Be});var Or,Ja,Re,Me,$t,xt,Dr=V(()=>{"use strict";ro();Or=(t,e)=>{(typeof Be.trace>"u"?!Be.wasm.trace:!Be.trace)||console.timeStamp(`${t}::ORT::${e}`)},Ja=(t,e)=>{let r=new Error().stack?.split(/\r\n|\r|\n/g)||[],n=!1;for(let o=0;o<r.length;o++){if(n&&!r[o].includes("TRACE_FUNC")){let i=`FUNC_${t}::${r[o].trim().split(" ")[1]}`;e&&(i+=`::${e}`),Or("CPU",i);return}r[o].includes("TRACE_FUNC")&&(n=!0)}},Re=t=>{(typeof Be.trace>"u"?!Be.wasm.trace:!Be.trace)||Ja("BEGIN",t)},Me=t=>{(typeof Be.trace>"u"?!Be.wasm.trace:!Be.trace)||Ja("END",t)},$t=t=>{(typeof Be.trace>"u"?!Be.wasm.trace:!Be.trace)||console.time(`ORT::${t}`)},xt=t=>{(typeof Be.trace>"u"?!Be.wasm.trace:!Be.trace)||console.timeEnd(`ORT::${t}`)}});var Ft,no=V(()=>{"use strict";Pr();Dr();Ft=class t{constructor(e,r){this.backend=e,this.handler=r}static async create(e){if(Re(),typeof e!="string"&&!(e instanceof Uint8Array))throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let r=await Ka(),n=await r.createLoraAdapterHandler(e);return Me(),new t(r,n)}async release(){return this.handler.dispose()}}});var es,ts,rs=V(()=>{"use strict";es=(t,e)=>{let r=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);r.width=t.dims[3],r.height=t.dims[2];let n=r.getContext("2d");if(n!=null){let o,i;e?.tensorLayout!==void 0&&e.tensorLayout==="NHWC"?(o=t.dims[2],i=t.dims[3]):(o=t.dims[3],i=t.dims[2]);let u=e?.format!==void 0?e.format:"RGB",s=e?.norm,d,c;s===void 0||s.mean===void 0?d=[255,255,255,255]:typeof s.mean=="number"?d=[s.mean,s.mean,s.mean,s.mean]:(d=[s.mean[0],s.mean[1],s.mean[2],0],s.mean[3]!==void 0&&(d[3]=s.mean[3])),s===void 0||s.bias===void 0?c=[0,0,0,0]:typeof s.bias=="number"?c=[s.bias,s.bias,s.bias,s.bias]:(c=[s.bias[0],s.bias[1],s.bias[2],0],s.bias[3]!==void 0&&(c[3]=s.bias[3]));let p=i*o,f=0,g=p,b=p*2,y=-1;u==="RGBA"?(f=0,g=p,b=p*2,y=p*3):u==="RGB"?(f=0,g=p,b=p*2):u==="RBG"&&(f=0,b=p,g=p*2);for(let $=0;$<i;$++)for(let T=0;T<o;T++){let _=(t.data[f++]-c[0])*d[0],w=(t.data[g++]-c[1])*d[1],S=(t.data[b++]-c[2])*d[2],I=y===-1?255:(t.data[y++]-c[3])*d[3];n.fillStyle="rgba("+_+","+w+","+S+","+I+")",n.fillRect(T,$,1,1)}if("toDataURL"in r)return r.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},ts=(t,e)=>{let r=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),n;if(r!=null){let o,i,u;e?.tensorLayout!==void 0&&e.tensorLayout==="NHWC"?(o=t.dims[2],i=t.dims[1],u=t.dims[3]):(o=t.dims[3],i=t.dims[2],u=t.dims[1]);let s=e!==void 0&&e.format!==void 0?e.format:"RGB",d=e?.norm,c,p;d===void 0||d.mean===void 0?c=[255,255,255,255]:typeof d.mean=="number"?c=[d.mean,d.mean,d.mean,d.mean]:(c=[d.mean[0],d.mean[1],d.mean[2],255],d.mean[3]!==void 0&&(c[3]=d.mean[3])),d===void 0||d.bias===void 0?p=[0,0,0,0]:typeof d.bias=="number"?p=[d.bias,d.bias,d.bias,d.bias]:(p=[d.bias[0],d.bias[1],d.bias[2],0],d.bias[3]!==void 0&&(p[3]=d.bias[3]));let f=i*o;if(e!==void 0&&(e.format!==void 0&&u===4&&e.format!=="RGBA"||u===3&&e.format!=="RGB"&&e.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let g=4,b=0,y=1,$=2,T=3,_=0,w=f,S=f*2,I=-1;s==="RGBA"?(_=0,w=f,S=f*2,I=f*3):s==="RGB"?(_=0,w=f,S=f*2):s==="RBG"&&(_=0,S=f,w=f*2),n=r.createImageData(o,i);for(let C=0;C<i*o;b+=g,y+=g,$+=g,T+=g,C++)n.data[b]=(t.data[_++]-p[0])*c[0],n.data[y]=(t.data[w++]-p[1])*c[1],n.data[$]=(t.data[S++]-p[2])*c[2],n.data[T]=I===-1?255:(t.data[I++]-p[3])*c[3]}else throw new Error("Can not access image data");return n}});var oo,ns,os,is,as,ss,us=V(()=>{"use strict";Br();oo=(t,e)=>{if(t===void 0)throw new Error("Image buffer must be defined");if(e.height===void 0||e.width===void 0)throw new Error("Image height and width must be defined");if(e.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:r,width:n}=e,o=e.norm??{mean:255,bias:0},i,u;typeof o.mean=="number"?i=[o.mean,o.mean,o.mean,o.mean]:i=[o.mean[0],o.mean[1],o.mean[2],o.mean[3]??255],typeof o.bias=="number"?u=[o.bias,o.bias,o.bias,o.bias]:u=[o.bias[0],o.bias[1],o.bias[2],o.bias[3]??0];let s=e.format!==void 0?e.format:"RGBA",d=e.tensorFormat!==void 0&&e.tensorFormat!==void 0?e.tensorFormat:"RGB",c=r*n,p=d==="RGBA"?new Float32Array(c*4):new Float32Array(c*3),f=4,g=0,b=1,y=2,$=3,T=0,_=c,w=c*2,S=-1;s==="RGB"&&(f=3,g=0,b=1,y=2,$=-1),d==="RGBA"?S=c*3:d==="RBG"?(T=0,w=c,_=c*2):d==="BGR"&&(w=0,_=c,T=c*2);for(let C=0;C<c;C++,g+=f,y+=f,b+=f,$+=f)p[T++]=(t[g]+u[0])/i[0],p[_++]=(t[b]+u[1])/i[1],p[w++]=(t[y]+u[2])/i[2],S!==-1&&$!==-1&&(p[S++]=(t[$]+u[3])/i[3]);return d==="RGBA"?new Ue("float32",p,[1,4,r,n]):new Ue("float32",p,[1,3,r,n])},ns=async(t,e)=>{let r=typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement,n=typeof ImageData<"u"&&t instanceof ImageData,o=typeof ImageBitmap<"u"&&t instanceof ImageBitmap,i=typeof t=="string",u,s=e??{},d=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},c=p=>typeof HTMLCanvasElement<"u"&&p instanceof HTMLCanvasElement||p instanceof OffscreenCanvas?p.getContext("2d"):null;if(r){let p=d();p.width=t.width,p.height=t.height;let f=c(p);if(f!=null){let g=t.height,b=t.width;if(e!==void 0&&e.resizedHeight!==void 0&&e.resizedWidth!==void 0&&(g=e.resizedHeight,b=e.resizedWidth),e!==void 0){if(s=e,e.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");s.tensorFormat="RGBA",s.height=g,s.width=b}else s.tensorFormat="RGBA",s.height=g,s.width=b;f.drawImage(t,0,0),u=f.getImageData(0,0,b,g).data}else throw new Error("Can not access image data")}else if(n){let p,f;if(e!==void 0&&e.resizedWidth!==void 0&&e.resizedHeight!==void 0?(p=e.resizedHeight,f=e.resizedWidth):(p=t.height,f=t.width),e!==void 0&&(s=e),s.format="RGBA",s.height=p,s.width=f,e!==void 0){let g=d();g.width=f,g.height=p;let b=c(g);if(b!=null)b.putImageData(t,0,0),u=b.getImageData(0,0,f,p).data;else throw new Error("Can not access image data")}else u=t.data}else if(o){if(e===void 0)throw new Error("Please provide image config with format for Imagebitmap");let p=d();p.width=t.width,p.height=t.height;let f=c(p);if(f!=null){let g=t.height,b=t.width;return f.drawImage(t,0,0,b,g),u=f.getImageData(0,0,b,g).data,s.height=g,s.width=b,oo(u,s)}else throw new Error("Can not access image data")}else{if(i)return new Promise((p,f)=>{let g=d(),b=c(g);if(!t||!b)return f();let y=new Image;y.crossOrigin="Anonymous",y.src=t,y.onload=()=>{g.width=y.width,g.height=y.height,b.drawImage(y,0,0,g.width,g.height);let $=b.getImageData(0,0,g.width,g.height);s.height=g.height,s.width=g.width,p(oo($.data,s))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(u!==void 0)return oo(u,s);throw new Error("Input data provided is not supported - aborted tensor creation")},os=(t,e)=>{let{width:r,height:n,download:o,dispose:i}=e,u=[1,n,r,4];return new Ue({location:"texture",type:"float32",texture:t,dims:u,download:o,dispose:i})},is=(t,e)=>{let{dataType:r,dims:n,download:o,dispose:i}=e;return new Ue({location:"gpu-buffer",type:r??"float32",gpuBuffer:t,dims:n,download:o,dispose:i})},as=(t,e)=>{let{dataType:r,dims:n,download:o,dispose:i}=e;return new Ue({location:"ml-tensor",type:r??"float32",mlTensor:t,dims:n,download:o,dispose:i})},ss=(t,e,r)=>new Ue({location:"cpu-pinned",type:t,data:e,dims:r??[e.length]})});var Bt,ur,ds,ls,cs=V(()=>{"use strict";Bt=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),ur=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),ds=!1,ls=()=>{if(!ds){ds=!0;let t=typeof BigInt64Array<"u"&&BigInt64Array.from,e=typeof BigUint64Array<"u"&&BigUint64Array.from,r=globalThis.Float16Array,n=typeof r<"u"&&r.from;t&&(Bt.set("int64",BigInt64Array),ur.set(BigInt64Array,"int64")),e&&(Bt.set("uint64",BigUint64Array),ur.set(BigUint64Array,"uint64")),n?(Bt.set("float16",r),ur.set(r,"float16")):Bt.set("float16",Uint16Array)}}});var ps,ms,fs=V(()=>{"use strict";Br();ps=t=>{let e=1;for(let r=0;r<t.length;r++){let n=t[r];if(typeof n!="number"||!Number.isSafeInteger(n))throw new TypeError(`dims[${r}] must be an integer, got: ${n}`);if(n<0)throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${n}`);e*=n}return e},ms=(t,e)=>{switch(t.location){case"cpu":return new Ue(t.type,t.data,e);case"cpu-pinned":return new Ue({location:"cpu-pinned",data:t.data,type:t.type,dims:e});case"texture":return new Ue({location:"texture",texture:t.texture,type:t.type,dims:e});case"gpu-buffer":return new Ue({location:"gpu-buffer",gpuBuffer:t.gpuBuffer,type:t.type,dims:e});case"ml-tensor":return new Ue({location:"ml-tensor",mlTensor:t.mlTensor,type:t.type,dims:e});default:throw new Error(`tensorReshape: tensor location ${t.location} is not supported`)}}});var Ue,Br=V(()=>{"use strict";rs();us();cs();fs();Ue=class{constructor(e,r,n){ls();let o,i;if(typeof e=="object"&&"location"in e)switch(this.dataLocation=e.location,o=e.type,i=e.dims,e.location){case"cpu-pinned":{let s=Bt.get(o);if(!s)throw new TypeError(`unsupported type "${o}" to create tensor from pinned buffer`);if(!(e.data instanceof s))throw new TypeError(`buffer should be of type ${s.name}`);this.cpuData=e.data;break}case"texture":{if(o!=="float32")throw new TypeError(`unsupported type "${o}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break}case"gpu-buffer":{if(o!=="float32"&&o!=="float16"&&o!=="int32"&&o!=="int64"&&o!=="uint32"&&o!=="uint8"&&o!=="bool"&&o!=="uint4"&&o!=="int4")throw new TypeError(`unsupported type "${o}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break}case"ml-tensor":{if(o!=="float32"&&o!=="float16"&&o!=="int32"&&o!=="int64"&&o!=="uint32"&&o!=="uint64"&&o!=="int8"&&o!=="uint8"&&o!=="bool"&&o!=="uint4"&&o!=="int4")throw new TypeError(`unsupported type "${o}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let s,d;if(typeof e=="string")if(o=e,d=n,e==="string"){if(!Array.isArray(r))throw new TypeError("A string tensor's data must be a string array.");s=r}else{let c=Bt.get(e);if(c===void 0)throw new TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(r)){if(e==="float16"&&c===Uint16Array||e==="uint4"||e==="int4")throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${c.name} as data.`);e==="uint64"||e==="int64"?s=c.from(r,BigInt):s=c.from(r)}else if(r instanceof c)s=r;else if(r instanceof Uint8ClampedArray)if(e==="uint8")s=Uint8Array.from(r);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(e==="float16"&&r instanceof Uint16Array&&c!==Uint16Array)s=new globalThis.Float16Array(r.buffer,r.byteOffset,r.length);else throw new TypeError(`A ${o} tensor's data must be type of ${c}`)}else if(d=r,Array.isArray(e)){if(e.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let c=typeof e[0];if(c==="string")o="string",s=e;else if(c==="boolean")o="bool",s=Uint8Array.from(e);else throw new TypeError(`Invalid element type of data array: ${c}.`)}else if(e instanceof Uint8ClampedArray)o="uint8",s=Uint8Array.from(e);else{let c=ur.get(e.constructor);if(c===void 0)throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);o=c,s=e}if(d===void 0)d=[s.length];else if(!Array.isArray(d))throw new TypeError("A tensor's dims must be a number array");i=d,this.cpuData=s,this.dataLocation="cpu"}let u=ps(i);if(this.cpuData&&u!==this.cpuData.length&&!((o==="uint4"||o==="int4")&&Math.ceil(u/2)===this.cpuData.length))throw new Error(`Tensor's size(${u}) does not match data length(${this.cpuData.length}).`);this.type=o,this.dims=i,this.size=u}static async fromImage(e,r){return ns(e,r)}static fromTexture(e,r){return os(e,r)}static fromGpuBuffer(e,r){return is(e,r)}static fromMLTensor(e,r){return as(e,r)}static fromPinnedBuffer(e,r,n){return ss(e,r,n)}toDataURL(e){return es(this,e)}toImageData(e){return ts(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let r=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=r,e&&this.disposer&&(this.disposer(),this.disposer=void 0),r}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return ms(this,e)}}});var je,io=V(()=>{"use strict";Br();je=Ue});var zr,hs=V(()=>{"use strict";Pr();no();io();Dr();zr=class t{constructor(e,r){this.handler=e,this.backend=r}async run(e,r,n){Re(),$t("InferenceSession.run");let o={},i={};if(typeof e!="object"||e===null||e instanceof je||Array.isArray(e))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let u=!0;if(typeof r=="object"){if(r===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(r instanceof je)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(r)){if(r.length===0)throw new TypeError("'fetches' cannot be an empty array.");u=!1;for(let p of r){if(typeof p!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(p)===-1)throw new RangeError(`'fetches' contains invalid output name: ${p}.`);o[p]=null}if(typeof n=="object"&&n!==null)i=n;else if(typeof n<"u")throw new TypeError("'options' must be an object.")}else{let p=!1,f=Object.getOwnPropertyNames(r);for(let g of this.outputNames)if(f.indexOf(g)!==-1){let b=r[g];(b===null||b instanceof je)&&(p=!0,u=!1,o[g]=b)}if(p){if(typeof n=="object"&&n!==null)i=n;else if(typeof n<"u")throw new TypeError("'options' must be an object.")}else i=r}}else if(typeof r<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let p of this.inputNames)if(typeof e[p]>"u")throw new Error(`input '${p}' is missing in 'feeds'.`);if(u)for(let p of this.outputNames)o[p]=null;let s;if(i.activeLoraAdapters!==void 0){if(!Array.isArray(i.activeLoraAdapters))throw new TypeError("'activeLoraAdapters' must be an array.");s=i.activeLoraAdapters.map(p=>{if(!(p instanceof Ft))throw new TypeError("'activeLoraAdapters' must be an array of LoraAdapter objects.");if(p.backend!==this.backend)throw new Error("LoRA adapter was created by a different backend than the session.");return p.handler})}let d=await this.handler.run(e,o,i,s),c={};for(let p in d)if(Object.hasOwnProperty.call(d,p)){let f=d[p];f instanceof je?c[p]=f:c[p]=new je(f.type,f.data,f.dims)}return xt("InferenceSession.run"),Me(),c}async release(){return this.handler.dispose()}static async create(e,r,n,o){Re(),$t("InferenceSession.create");let i,u={};if(typeof e=="string"){if(i=e,typeof r=="object"&&r!==null)u=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(e instanceof Uint8Array){if(i=e,typeof r=="object"&&r!==null)u=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(e instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&e instanceof SharedArrayBuffer){let p=e,f=0,g=e.byteLength;if(typeof r=="object"&&r!==null)u=r;else if(typeof r=="number"){if(f=r,!Number.isSafeInteger(f))throw new RangeError("'byteOffset' must be an integer.");if(f<0||f>=p.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${p.byteLength}).`);if(g=e.byteLength-f,typeof n=="number"){if(g=n,!Number.isSafeInteger(g))throw new RangeError("'byteLength' must be an integer.");if(g<=0||f+g>p.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${p.byteLength-f}].`);if(typeof o=="object"&&o!==null)u=o;else if(typeof o<"u")throw new TypeError("'options' must be an object.")}else if(typeof n<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof r<"u")throw new TypeError("'options' must be an object.");i=new Uint8Array(p,f,g)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[s,d]=await qa(u),c=await s.createInferenceSessionHandler(i,d);return xt("InferenceSession.create"),Me(),new t(c,s)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}});var Yf,gs=V(()=>{"use strict";hs();Yf=zr});var Xf,ys=V(()=>{"use strict";no();Xf=Ft});var bs=V(()=>{"use strict"});var _s=V(()=>{"use strict"});var ws=V(()=>{"use strict"});var vs=V(()=>{"use strict"});var ao={};Ht(ao,{InferenceSession:()=>Yf,LoraAdapter:()=>Xf,TRACE:()=>Or,TRACE_EVENT_BEGIN:()=>$t,TRACE_EVENT_END:()=>xt,TRACE_FUNC_BEGIN:()=>Re,TRACE_FUNC_END:()=>Me,Tensor:()=>je,env:()=>ve,registerBackend:()=>Dt});var Ve=V(()=>{"use strict";ja();Xa();gs();ys();io();bs();_s();Dr();ws();vs()});var Mr=V(()=>{"use strict"});var Ts={};Ht(Ts,{default:()=>Jf});var xs,Ss,Jf,Is=V(()=>{"use strict";so();St();Rr();xs="ort-wasm-proxy-worker",Ss=globalThis.self?.name===xs;Ss&&(self.onmessage=t=>{let{type:e,in:r}=t.data;try{switch(e){case"init-wasm":Ur(r.wasm).then(()=>{Nr(r).then(()=>{postMessage({type:e})},n=>{postMessage({type:e,err:n})})},n=>{postMessage({type:e,err:n})});break;case"init-ep":{let{epName:n,env:o}=r;Vr(o,n).then(()=>{postMessage({type:e})},i=>{postMessage({type:e,err:i})});break}case"copy-from":{let{buffer:n}=r,o=dr(n);postMessage({type:e,out:o});break}case"create":{let{model:n,options:o}=r;Lr(n,o).then(i=>{postMessage({type:e,out:i})},i=>{postMessage({type:e,err:i})});break}case"release":Wr(r),postMessage({type:e});break;case"run":{let{sessionId:n,inputIndices:o,inputs:i,outputIndices:u,options:s}=r;Gr(n,o,i,u,new Array(u.length).fill(null),s).then(d=>{d.some(c=>c[3]!=="cpu")?postMessage({type:e,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:e,out:d},Fr([...i,...d]))},d=>{postMessage({type:e,err:d})});break}case"end-profiling":Hr(r),postMessage({type:e});break;default:}}catch(n){postMessage({type:e,err:n})}});Jf=Ss?null:t=>new Worker(t??We,{type:"module",name:xs})});var Cs={};Ht(Cs,{default:()=>eh});async function As(t={}){var e=t,r=!!globalThis.window,n=!!globalThis.WorkerGlobalScope,o=n&&self.name?.startsWith("em-pthread");e.mountExternalData=(a,l)=>{a.startsWith("./")&&(a=a.substring(2)),(e.jd||(e.jd=new Map)).set(a,l)},e.unmountExternalData=()=>{delete e.jd,delete e.ke,delete e.je,delete e.le},globalThis.SharedArrayBuffer??new WebAssembly.Memory({initial:0,maximum:0,shared:!0}).buffer.constructor;let i=a=>async(...l)=>{try{if(e.hd)throw Error("Session already started");let h=e.hd={Vd:l[0],errors:[]},m=await a(...l);if(e.hd!==h)throw Error("Session mismatch");e.pd?.flush();let v=h.errors;if(0<v.length){let A=await Promise.all(v);if(A=A.filter(P=>P),0<A.length)throw Error(A.join(`
`))}return m}finally{e.hd=null}};e.jsepInit=(a,l)=>{if(a==="webgpu"){[e.pd,e.Ld,e.Pd,e.rd,e.Od,e.ic,e.Qd,e.Sd,e.Md,e.Nd,e.Rd]=l;let h=e.pd;e.jsepRegisterBuffer=(m,v,A,P)=>h.registerBuffer(m,v,A,P),e.jsepGetBuffer=m=>h.getBuffer(m),e.jsepCreateDownloader=(m,v,A)=>h.createDownloader(m,v,A),e.jsepOnCreateSession=m=>{h.onCreateSession(m)},e.jsepOnReleaseSession=m=>{h.onReleaseSession(m)},e.jsepOnRunStart=m=>h.onRunStart(m),e.Td=(m,v)=>{h.upload(m,v)}}else if(a==="webnn"){let h=l[0];[e.ce,e.Cd,e.webnnEnsureTensor,e.Dd,e.webnnDownloadTensor,e.be,e.webnnEnableTraceEvent]=l.slice(1),e.webnnReleaseTensorId=e.Cd,e.webnnUploadTensor=e.Dd,e.webnnRegisterMLContext=e.be,e.webnnOnRunStart=m=>h.onRunStart(m),e.webnnOnRunEnd=h.onRunEnd.bind(h),e.webnnOnReleaseSession=m=>{h.onReleaseSession(m)},e.webnnCreateMLTensorDownloader=(m,v)=>h.createMLTensorDownloader(m,v),e.webnnRegisterMLTensor=(m,v,A,P)=>h.registerMLTensor(m,v,A,P),e.webnnCreateMLContext=m=>h.createMLContext(m),e.webnnRegisterGraphInput=h.registerGraphInput.bind(h),e.webnnIsGraphInput=h.isGraphInput.bind(h),e.webnnRegisterGraphOutput=h.registerGraphOutput.bind(h),e.webnnIsGraphOutput=h.isGraphOutput.bind(h),e.webnnCreateTemporaryTensor=h.createTemporaryTensor.bind(h),e.webnnIsGraphInputOutputTypeSupported=h.isGraphInputOutputTypeSupported.bind(h)}};let u=()=>{let a=l=>(...h)=>{let m=et;return h=l(...h),et!=m?new Promise((v,A)=>{Ln={resolve:v,reject:A}}):h};(l=>{for(let h of l)e[h]=a(e[h])})("_OrtAppendExecutionProvider _OrtAppendExecutionProviderV2 _OrtCreateSession _OrtRun _OrtRunWithBinding _OrtBindInput".split(" ")),i!==void 0&&(e._OrtRun=i(e._OrtRun),e._OrtRunWithBinding=i(e._OrtRunWithBinding)),u=void 0};e.asyncInit=()=>{u?.()};var s,d,c=(a,l)=>{throw l},p=import.meta.url,f="";if(r||n){try{f=new URL(".",p).href}catch{}n&&(d=a=>{var l=new XMLHttpRequest;return l.open("GET",a,!1),l.responseType="arraybuffer",l.send(null),new Uint8Array(l.response)}),s=async a=>{if(B(a))return new Promise((h,m)=>{var v=new XMLHttpRequest;v.open("GET",a,!0),v.responseType="arraybuffer",v.onload=()=>{v.status==200||v.status==0&&v.response?h(v.response):m(v.status)},v.onerror=m,v.send(null)});var l=await fetch(a,{credentials:"same-origin"});if(l.ok)return l.arrayBuffer();throw Error(l.status+" : "+l.url)}}var g,b,y,$,T,_,w=console.log.bind(console),S=console.error.bind(console),I=w,C=S,E=!1,B=a=>a.startsWith("file://");function x(){yt.buffer!=N.buffer&&fe()}if(o){let a=function(l){try{var h=l.data,m=h.bd;if(m==="load"){let v=[];self.onmessage=A=>v.push(A),_=()=>{postMessage({bd:"loaded"});for(let A of v)a(A);self.onmessage=a};for(let A of h.Hd)e[A]&&!e[A].proxy||(e[A]=(...P)=>{postMessage({bd:"callHandler",Fd:A,args:P})},A=="print"&&(I=e[A]),A=="printErr"&&(C=e[A]));yt=h.Zd,fe(),b=h.$d,he(),kr()}else if(m==="run"){(function(v){var A=(x(),j)[v+52>>>2>>>0];v=(x(),j)[v+56>>>2>>>0],Xi(A,A-v),se(A)})(h.ad),qn(h.ad,0,0,1,0,0),Xo(),Un(h.ad),U||(qi(),U=!0);try{Bp(h.Xd,h.nd)}catch(v){if(v!="unwind")throw v}}else h.target!=="setimmediate"&&(m==="checkMailbox"?U&&xr():m&&(C(`worker: received unknown command ${m}`),C(h)))}catch(v){throw Ki(),v}};var Bb=a,U=!1;self.onunhandledrejection=l=>{throw l.reason||l},self.onmessage=a}var N,F,Z,ee,D,j,Y,L,J,le,ne,be=!1;function fe(){var a=yt.buffer;e.HEAP8=N=new Int8Array(a),Z=new Int16Array(a),e.HEAPU8=F=new Uint8Array(a),ee=new Uint16Array(a),e.HEAP32=D=new Int32Array(a),e.HEAPU32=j=new Uint32Array(a),Y=new Float32Array(a),L=new Float64Array(a),J=new BigInt64Array(a),le=new BigUint64Array(a)}function ue(){be=!0,o?_():ct.vb()}function M(a){throw C(a="Aborted("+a+")"),E=!0,a=new WebAssembly.RuntimeError(a+". Build with -sASSERTIONS for more info."),T?.(a),a}function G(){return{a:{na:af,jb:of,g:zp,G:Mp,f:Rp,o:Up,h:Np,$:Vp,b:Lp,S:Wp,Ja:oi,n:Gp,aa:ui,_a:di,Fa:li,Ha:ci,$a:pi,Ya:mi,Ra:fi,Xa:hi,la:gi,Ga:yi,Da:bi,Za:_i,Ea:wi,eb:Hp,ga:qp,ya:Kp,wa:Zp,fa:Yp,N:Xp,I:Jp,xa:em,_:sm,za:um,Ua:dm,Ba:cm,Ka:pm,ua:mm,ha:fm,Ta:Un,bb:hm,Q:_m,r:Sm,c:Mn,kb:Tm,y:Im,M:Am,D:Cm,m:Em,s:Ci,lb:km,J:Pm,R:Om,j:Dm,u:Bm,q:zm,k:Mm,Oa:Rm,Pa:Um,Qa:Nm,Ma:Oi,Na:Di,va:Bi,gb:Lm,db:Hm,v:Fm,ba:qm,ia:Km,cb:Wm,V:jm,ab:Zm,Ca:Qm,F:Vm,U:Ym,ma:Cr,Aa:Jm,ib:Xm,hb:ef,Va:Ui,Wa:Ni,Ia:br,T:Vi,La:Li,ka:Wi,Sa:Gi,ja:Hi,nb:Hf,oa:Nf,ob:Gf,pa:Uf,H:Af,e:lf,t:uf,w:sf,B:vf,pb:zf,Z:Bf,x:ff,qa:Mf,X:Vf,ca:Df,qb:Of,ea:pf,O:$f,sb:Ef,ra:Pf,tb:Cf,L:Tf,Y:Rf,d:df,A:mf,l:cf,mb:Ff,p:gf,z:yf,C:hf,E:bf,K:xf,sa:If,P:Lf,da:Sf,W:Wf,ub:wf,ta:_f,rb:kf,i:rf,a:yt,fb:ht}}}async function he(){function a(m,v){var A=ct=m.exports;m={};for(let[P,z]of Object.entries(A))typeof z=="function"?(A=gm(z),m[P]=A):m[P]=z;return ct=m,ct=(function(){var P=ct,z=q=>ie=>q(ie)>>>0,H=q=>()=>q()>>>0;return(P=Object.assign({},P)).wb=z(P.wb),P.ec=H(P.ec),P.gc=z(P.gc),P.uc=z(P.uc),P.vc=H(P.vc),P.zc=z(P.zc),P})(),Qo.push(ct.hc),Fi=(m=ct).wb,qi=m.xb,e._OrtInit=m.yb,e._OrtGetLastError=m.zb,e._OrtCreateSessionOptions=m.Ab,e._OrtAppendExecutionProvider=m.Bb,e._OrtGetEpDevices=m.Cb,e._OrtEpDevice_EpName=m.Db,e._OrtAppendExecutionProviderV2=m.Eb,e._OrtAddFreeDimensionOverride=m.Fb,e._OrtAddSessionConfigEntry=m.Gb,e._OrtReleaseSessionOptions=m.Hb,e._OrtCreateSession=m.Ib,e._OrtReleaseSession=m.Jb,e._OrtGetInputOutputCount=m.Kb,e._OrtGetInputOutputMetadata=m.Lb,e._OrtFree=m.Mb,e._OrtCreateTensor=m.Nb,e._OrtGetTensorData=m.Ob,e._OrtReleaseTensor=m.Pb,e._OrtCreateLoraAdapter=m.Qb,e._OrtReleaseLoraAdapter=m.Rb,e._OrtCreateRunOptions=m.Sb,e._OrtAddRunConfigEntry=m.Tb,e._OrtRunOptionsAddActiveLoraAdapter=m.Ub,e._OrtReleaseRunOptions=m.Vb,e._OrtCreateBinding=m.Wb,e._OrtBindInput=m.Xb,e._OrtBindOutput=m.Yb,e._OrtClearBoundOutputs=m.Zb,e._OrtReleaseBinding=m._b,e._OrtRunWithBinding=m.$b,e._OrtRun=m.ac,e._OrtEndProfiling=m.bc,e._JsepOutput=m.cc,e._JsepGetNodeName=m.dc,Er=m.ec,tt=e._free=m.fc,or=e._malloc=m.gc,qn=m.jc,Ki=m.kc,ji=m.lc,Zi=m.mc,Kn=m.nc,Qi=m.oc,Yi=m.pc,ce=m.qc,ir=m.rc,Xi=m.sc,se=m.tc,jn=m.uc,de=m.vc,Ji=m.wc,Zn=m.xc,ea=m.yc,ta=m.zc,ra=m.Ac,Qn=m.Bc,na=m.Cc,oa=m.Dc,ia=m.Ec,aa=m.Fc,sa=m.Gc,ua=m.Hc,da=m.Ic,la=m.Jc,ca=m.Kc,pa=m.Lc,ma=m.Mc,fa=m.Nc,ha=m.Oc,ga=m.Pc,ya=m.Qc,ba=m.Rc,_a=m.Sc,wa=m.Tc,va=m.Uc,$a=m.Vc,xa=m.Wc,Sa=m.Xc,Ta=m.Yc,Ia=m._c,Aa=m.$c,Ca=m.kd,Ea=m.ld,ka=m.qd,Pa=m.vd,Oa=m.wd,Da=m.xd,Ba=m.yd,za=m.zd,Ma=m.Ad,Ra=m.Bd,Ua=m.Gd,Na=m.Jd,Va=m.fe,La=m.ge,Wa=m.he,Ga=m.ie,b=v,ct}var l,h=G();return e.instantiateWasm?new Promise(m=>{e.instantiateWasm(h,(v,A)=>{m(a(v,A))})}):o?a(new WebAssembly.Instance(b,G()),b):(ne??=e.locateFile?e.locateFile?e.locateFile("ort-wasm-simd-threaded.jsep.wasm",f):f+"ort-wasm-simd-threaded.jsep.wasm":new URL("ort-wasm-simd-threaded.jsep.wasm",import.meta.url).href,l=await(async function(m){var v=ne;if(!g&&!B(v))try{var A=fetch(v,{credentials:"same-origin"});return await WebAssembly.instantiateStreaming(A,m)}catch(P){C(`wasm streaming compile failed: ${P}`),C("falling back to ArrayBuffer instantiation")}return(async function(P,z){try{var H=await(async function(q){if(!g)try{var ie=await s(q);return new Uint8Array(ie)}catch{}if(q==ne&&g)q=new Uint8Array(g);else{if(!d)throw"both async and sync fetching of the wasm failed";q=d(q)}return q})(P);return await WebAssembly.instantiate(H,z)}catch(q){C(`failed to asynchronously prepare wasm: ${q}`),M(q)}})(v,m)})(h),a(l.instance,l.module))}class Ne{name="ExitStatus";constructor(l){this.message=`Program terminated with exit(${l})`,this.status=l}}var Ae=a=>{a.terminate(),a.onmessage=()=>{}},ke=[],Ce=0,qe=null,Pe=a=>{gt.length==0&&(ei(),Jo(gt[0]));var l=gt.pop();if(!l)return 6;rr.push(l),kt[a.ad]=l,l.ad=a.ad;var h={bd:"run",Xd:a.Wd,nd:a.nd,ad:a.ad};return l.postMessage(h,a.ud),0},xe=0,ge=(a,l,...h)=>{var m,v=16*h.length,A=de(),P=jn(v),z=P>>>3;for(m of h)typeof m=="bigint"?((x(),J)[z++>>>0]=1n,(x(),J)[z++>>>0]=m):((x(),J)[z++>>>0]=0n,(x(),L)[z++>>>0]=m);return a=ji(a,0,v,P,l),se(A),a};function ht(a){if(o)return ge(0,1,a);if(y=a,!(0<xe)){for(var l of rr)Ae(l);for(l of gt)Ae(l);gt=[],rr=[],kt={},E=!0}c(0,new Ne(a))}function tr(a){if(o)return ge(1,0,a);br(a)}var br=a=>{if(y=a,o)throw tr(a),"unwind";ht(a)},gt=[],rr=[],Qo=[],kt={},Yo=a=>{var l=a.ad;delete kt[l],gt.push(a),rr.splice(rr.indexOf(a),1),a.ad=0,Zi(l)};function Xo(){Qo.forEach(a=>a())}var Jo=a=>new Promise(l=>{a.onmessage=v=>{var A=v.data;if(v=A.bd,A.md&&A.md!=Er()){var P=kt[A.md];P?P.postMessage(A,A.ud):C(`Internal error! Worker sent a message "${v}" to target pthread ${A.md}, but that thread no longer exists!`)}else v==="checkMailbox"?xr():v==="spawnThread"?Pe(A):v==="cleanupThread"?$r(()=>{Yo(kt[A.Yd])}):v==="loaded"?(a.loaded=!0,l(a)):A.target==="setimmediate"?a.postMessage(A):v==="uncaughtException"?a.onerror(A.error):v==="callHandler"?e[A.Fd](...A.args):v&&C(`worker sent an unknown command ${v}`)},a.onerror=v=>{throw C(`worker sent an error! ${v.filename}:${v.lineno}: ${v.message}`),v};var h,m=[];for(h of[])e.propertyIsEnumerable(h)&&m.push(h);a.postMessage({bd:"load",Hd:m,Zd:yt,$d:b})});function ei(){var a=new Worker((()=>{let l=URL;return import.meta.url>"file:"&&import.meta.url<"file;"?new l("ort.bundle.min.mjs",import.meta.url):new URL(import.meta.url)})(),{type:"module",workerData:"em-pthread",name:"em-pthread"});gt.push(a)}var yt,Bp=(a,l)=>{xe=0,a=Qn(a,l),0<xe?y=a:Kn(a)},_r=[],wr=0;function zp(a){var l=new On(a>>>=0);return(x(),N)[l.cd+12>>>0]==0&&(ti(l,!0),wr--),ri(l,!1),_r.push(l),ta(a)}var Wt=0,Mp=()=>{ce(0,0);var a=_r.pop();Ji(a.od),Wt=0};function ti(a,l){l=l?1:0,(x(),N)[a.cd+12>>>0]=l}function ri(a,l){l=l?1:0,(x(),N)[a.cd+13>>>0]=l}class On{constructor(l){this.od=l,this.cd=l-24}}var Dn=a=>{var l=Wt;if(!l)return ir(0),0;var h=new On(l);(x(),j)[h.cd+16>>>2>>>0]=l;var m=(x(),j)[h.cd+4>>>2>>>0];if(!m)return ir(0),l;for(var v of a){if(v===0||v===m)break;if(ea(v,m,h.cd+16))return ir(v),l}return ir(m),l};function Rp(){return Dn([])}function Up(a){return Dn([a>>>0])}function Np(a,l,h,m){return Dn([a>>>0,l>>>0,h>>>0,m>>>0])}var Vp=()=>{var a=_r.pop();a||M("no exception to throw");var l=a.od;throw(x(),N)[a.cd+13>>>0]==0&&(_r.push(a),ri(a,!0),ti(a,!1),wr++),Zn(l),Wt=l};function Lp(a,l,h){var m=new On(a>>>=0);throw l>>>=0,h>>>=0,(x(),j)[m.cd+16>>>2>>>0]=0,(x(),j)[m.cd+4>>>2>>>0]=l,(x(),j)[m.cd+8>>>2>>>0]=h,Zn(a),wr++,Wt=a}var Wp=()=>wr;function ni(a,l,h,m){return o?ge(2,1,a,l,h,m):oi(a,l,h,m)}function oi(a,l,h,m){if(a>>>=0,l>>>=0,h>>>=0,m>>>=0,!globalThis.SharedArrayBuffer)return 6;var v=[];return o&&v.length===0?ni(a,l,h,m):(a={Wd:h,ad:a,nd:m,ud:v},o?(a.bd="spawnThread",postMessage(a,v),0):Pe(a))}function Gp(a){throw Wt||=a>>>0,Wt}var ii=globalThis.TextDecoder&&new TextDecoder,ai=(a,l,h,m)=>{if(h=l+h,m)return h;for(;a[l]&&!(l>=h);)++l;return l},si=(a,l=0,h,m)=>{if(16<(h=ai(a,l>>>=0,h,m))-l&&a.buffer&&ii)return ii.decode(a.buffer instanceof ArrayBuffer?a.subarray(l,h):a.slice(l,h));for(m="";l<h;){var v=a[l++];if(128&v){var A=63&a[l++];if((224&v)==192)m+=String.fromCharCode((31&v)<<6|A);else{var P=63&a[l++];65536>(v=(240&v)==224?(15&v)<<12|A<<6|P:(7&v)<<18|A<<12|P<<6|63&a[l++])?m+=String.fromCharCode(v):(v-=65536,m+=String.fromCharCode(55296|v>>10,56320|1023&v))}}else m+=String.fromCharCode(v)}return m},Oe=(a,l,h)=>(a>>>=0)?si((x(),F),a,l,h):"";function ui(a,l,h){return o?ge(3,1,a,l,h):0}function di(a,l){if(o)return ge(4,1,a,l)}function li(a,l){if(o)return ge(5,1,a,l)}function ci(a,l,h){if(o)return ge(6,1,a,l,h)}function pi(a,l,h){return o?ge(7,1,a,l,h):0}function mi(a,l){if(o)return ge(8,1,a,l)}function fi(a,l,h){if(o)return ge(9,1,a,l,h)}function hi(a,l,h,m){if(o)return ge(10,1,a,l,h,m)}function gi(a,l,h,m){if(o)return ge(11,1,a,l,h,m)}function yi(a,l,h,m){if(o)return ge(12,1,a,l,h,m)}function bi(a){if(o)return ge(13,1,a)}function _i(a,l){if(o)return ge(14,1,a,l)}function wi(a,l,h){if(o)return ge(15,1,a,l,h)}var Hp=()=>M(""),Je=a=>{a>>>=0;for(var l="";;){var h=(x(),F)[a++>>>0];if(!h)return l;l+=String.fromCharCode(h)}},Bn={},zn={},Fp={},Gt=class extends Error{constructor(a){super(a),this.name="BindingError"}};function lt(a,l,h={}){return(function(m,v,A={}){var P=v.name;if(!m)throw new Gt(`type "${P}" must have a positive integer typeid pointer`);if(zn.hasOwnProperty(m)){if(A.Id)return;throw new Gt(`Cannot register type '${P}' twice`)}zn[m]=v,delete Fp[m],Bn.hasOwnProperty(m)&&(v=Bn[m],delete Bn[m],v.forEach(z=>z()))})(a,l,h)}var vi=(a,l,h)=>{switch(l){case 1:return h?m=>(x(),N)[m>>>0]:m=>(x(),F)[m>>>0];case 2:return h?m=>(x(),Z)[m>>>1>>>0]:m=>(x(),ee)[m>>>1>>>0];case 4:return h?m=>(x(),D)[m>>>2>>>0]:m=>(x(),j)[m>>>2>>>0];case 8:return h?m=>(x(),J)[m>>>3>>>0]:m=>(x(),le)[m>>>3>>>0];default:throw new TypeError(`invalid integer width (${l}): ${a}`)}};function qp(a,l,h,m,v){a>>>=0,h>>>=0,l=Je(l>>>0);let A=P=>P;if(m=m===0n){let P=8*h;A=z=>BigInt.asUintN(P,z),v=A(v)}lt(a,{name:l,Zc:A,ed:(P,z)=>(typeof z=="number"&&(z=BigInt(z)),z),dd:vi(l,h,!m),gd:null})}function Kp(a,l,h,m){lt(a>>>=0,{name:l=Je(l>>>0),Zc:function(v){return!!v},ed:function(v,A){return A?h:m},dd:function(v){return this.Zc((x(),F)[v>>>0])},gd:null})}var $i=[],Pt=[0,1,,1,null,1,!0,1,!1,1];function Mn(a){9<(a>>>=0)&&--Pt[a+1]===0&&(Pt[a]=void 0,$i.push(a))}var He=a=>{if(!a)throw new Gt(`Cannot use deleted val. handle = ${a}`);return Pt[a]},Ke=a=>{switch(a){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let l=$i.pop()||Pt.length;return Pt[l]=a,Pt[l+1]=1,l}};function Rn(a){return this.Zc((x(),j)[a>>>2>>>0])}var jp={name:"emscripten::val",Zc:a=>{var l=He(a);return Mn(a),l},ed:(a,l)=>Ke(l),dd:Rn,gd:null};function Zp(a){return lt(a>>>0,jp)}var Qp=(a,l)=>{switch(l){case 4:return function(h){return this.Zc((x(),Y)[h>>>2>>>0])};case 8:return function(h){return this.Zc((x(),L)[h>>>3>>>0])};default:throw new TypeError(`invalid float width (${l}): ${a}`)}};function Yp(a,l,h){h>>>=0,lt(a>>>=0,{name:l=Je(l>>>0),Zc:m=>m,ed:(m,v)=>v,dd:Qp(l,h),gd:null})}function Xp(a,l,h,m,v){a>>>=0,h>>>=0,l=Je(l>>>0);let A=z=>z;if(m===0){var P=32-8*h;A=z=>z<<P>>>P,v=A(v)}lt(a,{name:l,Zc:A,ed:(z,H)=>H,dd:vi(l,h,m!==0),gd:null})}function Jp(a,l,h){function m(A){var P=(x(),j)[A>>>2>>>0];return A=(x(),j)[A+4>>>2>>>0],new v((x(),N).buffer,A,P)}var v=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][l];lt(a>>>=0,{name:h=Je(h>>>0),Zc:m,dd:m},{Id:!0})}var bt=(a,l,h)=>{var m=(x(),F);if(l>>>=0,0<h){var v=l;h=l+h-1;for(var A=0;A<a.length;++A){var P=a.codePointAt(A);if(127>=P){if(l>=h)break;m[l++>>>0]=P}else if(2047>=P){if(l+1>=h)break;m[l++>>>0]=192|P>>6,m[l++>>>0]=128|63&P}else if(65535>=P){if(l+2>=h)break;m[l++>>>0]=224|P>>12,m[l++>>>0]=128|P>>6&63,m[l++>>>0]=128|63&P}else{if(l+3>=h)break;m[l++>>>0]=240|P>>18,m[l++>>>0]=128|P>>12&63,m[l++>>>0]=128|P>>6&63,m[l++>>>0]=128|63&P,A++}}m[l>>>0]=0,a=l-v}else a=0;return a},vr=a=>{for(var l=0,h=0;h<a.length;++h){var m=a.charCodeAt(h);127>=m?l++:2047>=m?l+=2:55296<=m&&57343>=m?(l+=4,++h):l+=3}return l};function em(a,l){lt(a>>>=0,{name:l=Je(l>>>0),Zc(h){var m=(x(),j)[h>>>2>>>0];return m=Oe(h+4,m,!0),tt(h),m},ed(h,m){m instanceof ArrayBuffer&&(m=new Uint8Array(m));var v=typeof m=="string";if(!(v||ArrayBuffer.isView(m)&&m.BYTES_PER_ELEMENT==1))throw new Gt("Cannot pass non-string to std::string");var A=v?vr(m):m.length,P=or(4+A+1),z=P+4;return(x(),j)[P>>>2>>>0]=A,v?bt(m,z,A+1):(x(),F).set(m,z>>>0),h!==null&&h.push(tt,P),P},dd:Rn,gd(h){tt(h)}})}var xi=globalThis.TextDecoder?new TextDecoder("utf-16le"):void 0,tm=(a,l,h)=>{if(a>>>=1,16<(l=ai((x(),ee),a,l/2,h))-a&&xi)return xi.decode((x(),ee).slice(a,l));for(h="";a<l;++a){var m=(x(),ee)[a>>>0];h+=String.fromCharCode(m)}return h},rm=(a,l,h)=>{if(h??=2147483647,2>h)return 0;var m=l;h=(h-=2)<2*a.length?h/2:a.length;for(var v=0;v<h;++v){var A=a.charCodeAt(v);(x(),Z)[l>>>1>>>0]=A,l+=2}return(x(),Z)[l>>>1>>>0]=0,l-m},nm=a=>2*a.length,om=(a,l,h)=>{var m="";a>>>=2;for(var v=0;!(v>=l/4);v++){var A=(x(),j)[a+v>>>0];if(!A&&!h)break;m+=String.fromCodePoint(A)}return m},im=(a,l,h)=>{if(l>>>=0,h??=2147483647,4>h)return 0;var m=l;h=m+h-4;for(var v=0;v<a.length;++v){var A=a.codePointAt(v);if(65535<A&&v++,(x(),D)[l>>>2>>>0]=A,(l+=4)+4>h)break}return(x(),D)[l>>>2>>>0]=0,l-m},am=a=>{for(var l=0,h=0;h<a.length;++h)65535<a.codePointAt(h)&&h++,l+=4;return l};function sm(a,l,h){if(a>>>=0,l>>>=0,h=Je(h>>>=0),l===2)var m=tm,v=rm,A=nm;else m=om,v=im,A=am;lt(a,{name:h,Zc:P=>{var z=(x(),j)[P>>>2>>>0];return z=m(P+4,z*l,!0),tt(P),z},ed:(P,z)=>{if(typeof z!="string")throw new Gt(`Cannot pass non-string to C++ string type ${h}`);var H=A(z),q=or(4+H+l);return(x(),j)[q>>>2>>>0]=H/l,v(z,q+4,H+l),P!==null&&P.push(tt,q),q},dd:Rn,gd(P){tt(P)}})}function um(a,l){lt(a>>>=0,{Kd:!0,name:l=Je(l>>>0),Zc:()=>{},ed:()=>{}})}function dm(a){qn(a>>>0,!n,1,!r,131072,!1),Xo()}var $r=a=>{if(!E)try{if(a(),!(0<xe))try{o?Er()&&Kn(y):br(y)}catch(l){l instanceof Ne||l=="unwind"||c(0,l)}}catch(l){l instanceof Ne||l=="unwind"||c(0,l)}},lm=!Atomics.waitAsync||globalThis.navigator?.userAgent&&91>Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)||[])[2]);function Un(a){a>>>=0,lm||(Atomics.waitAsync((x(),D),a>>>2,a).value.then(xr),a+=128,Atomics.store((x(),D),a>>>2,1))}var xr=()=>$r(()=>{var a=Er();a&&(Un(a),Yi())});function cm(a,l){(a>>>=0)==l>>>0?setTimeout(xr):o?postMessage({md:a,bd:"checkMailbox"}):(a=kt[a])&&a.postMessage({bd:"checkMailbox"})}var Nn=[];function pm(a,l,h,m,v){for(l>>>=0,v>>>=0,Nn.length=0,h=v>>>3,m=v+m>>>3;h<m;){var A;A=(x(),J)[h++>>>0]?(x(),J)[h++>>>0]:(x(),L)[h++>>>0],Nn.push(A)}return(l?Yn[l]:nf[a])(...Nn)}var mm=()=>{xe=0};function fm(a){a>>>=0,o?postMessage({bd:"cleanupThread",Yd:a}):Yo(kt[a])}function hm(a){}var Sr=a=>{try{a()}catch(l){M(l)}};function gm(a){var l=(...h)=>{Tr.push(a);try{return a(...h)}finally{E||(Tr.pop(),et&&_t===1&&Tr.length===0&&(_t=0,xe+=1,Sr(La),typeof Fibers<"u"&&Fibers.ne()))}};return Ii.set(a,l),l}var _t=0,et=null,Si=0,Tr=[],Vn=new Map,Ti=new Map,Ii=new Map,ym=0,Ln=null,bm=[],Ai=a=>(function(l){if(!E){if(_t===0){var h=!1,m=!1;l((v=0)=>{if(!E&&(Si=v,h=!0,m)){_t=2,Sr(()=>Wa(et)),typeof MainLoop<"u"&&MainLoop.Ed&&MainLoop.resume(),v=!1;try{var A=(function(){var H=(x(),D)[et+8>>>2>>>0];return H=Ti.get(H),H=Ii.get(H),--xe,H()})()}catch(H){A=H,v=!0}var P=!1;if(!et){var z=Ln;z&&(Ln=null,(v?z.reject:z.resolve)(A),P=!0)}if(v&&!P)throw A}}),m=!0,h||(_t=1,et=(function(){var v=or(65548),A=v+12;if((x(),j)[v>>>2>>>0]=A,(x(),j)[v+4>>>2>>>0]=A+65536,A=Tr[0],!Vn.has(A)){var P=ym++;Vn.set(A,P),Ti.set(P,A)}return A=Vn.get(A),(x(),D)[v+8>>>2>>>0]=A,v})(),typeof MainLoop<"u"&&MainLoop.Ed&&MainLoop.pause(),Sr(()=>Va(et)))}else _t===2?(_t=0,Sr(Ga),tt(et),et=null,bm.forEach($r)):M(`invalid state: ${_t}`);return Si}})(l=>{a().then(l)});function _m(a){return a>>>=0,Ai(async()=>{var l=await He(a);return Ke(l)})}var Wn=[],wm=a=>{var l=Wn.length;return Wn.push(a),l},vm=(a,l)=>{for(var h=Array(a),m=0;m<a;++m){var v=m,A=(x(),j)[l+4*m>>>2>>>0],P=zn[A];if(P===void 0)throw a=`parameter ${m}`,A=Fi(A),l=Je(A),tt(A),new Gt(`${a} has unknown type ${l}`);h[v]=P}return h},$m=(a,l,h)=>{var m=[];return a=a(m,h),m.length&&((x(),j)[l>>>2>>>0]=Ke(m)),a},xm={},Ir=a=>{var l=xm[a];return l===void 0?Je(a):l};function Sm(a,l,h){var[m,...v]=vm(a,l>>>0);l=m.ed.bind(m);var A=v.map(H=>H.dd.bind(H));a--;var P={toValue:He};switch(a=A.map((H,q)=>{var ie=`argFromPtr${q}`;return P[ie]=H,`${ie}(args${q?"+"+8*q:""})`}),h){case 0:var z="toValue(handle)";break;case 2:z="new (toValue(handle))";break;case 3:z="";break;case 1:P.getStringOrSymbol=Ir,z="toValue(handle)[getStringOrSymbol(methodName)]"}return z+=`(${a})`,m.Kd||(P.toReturnWire=l,P.emval_returnValue=$m,z=`return emval_returnValue(toReturnWire, destructorsRef, ${z})`),z=`return function (handle, methodName, destructorsRef, args) {
  ${z}
  }`,h=new Function(Object.keys(P),z)(...Object.values(P)),z=`methodCaller<(${v.map(H=>H.name)}) => ${m.name}>`,wm(Object.defineProperty(h,"name",{value:z}))}function Tm(a,l){return l>>>=0,(a=He(a>>>0))==He(l)}function Im(a){return(a>>>=0)?(a=Ir(a),Ke(globalThis[a])):Ke(globalThis)}function Am(a){return a=Ir(a>>>0),Ke(e[a])}function Cm(a,l){return l>>>=0,a=He(a>>>0),l=He(l),Ke(a[l])}function Em(a){9<(a>>>=0)&&(Pt[a+1]+=1)}function Ci(a,l,h,m,v){return Wn[a>>>0](l>>>0,h>>>0,m>>>0,v>>>0)}function km(a,l,h,m,v){return Ci(a>>>0,l>>>0,h>>>0,m>>>0,v>>>0)}function Pm(){return Ke([])}function Om(a){a=He(a>>>0);for(var l=Array(a.length),h=0;h<a.length;h++)l[h]=a[h];return Ke(l)}function Dm(a){return Ke(Ir(a>>>0))}function Bm(){return Ke({})}function zm(a){for(var l=He(a>>>=0);l.length;){var h=l.pop();l.pop()(h)}Mn(a)}function Mm(a,l,h){l>>>=0,h>>>=0,a=He(a>>>0),l=He(l),h=He(h),a[l]=h}function Rm(a,l){a=-9007199254740992>a||9007199254740992<a?NaN:Number(a),l>>>=0,a=new Date(1e3*a),(x(),D)[l>>>2>>>0]=a.getUTCSeconds(),(x(),D)[l+4>>>2>>>0]=a.getUTCMinutes(),(x(),D)[l+8>>>2>>>0]=a.getUTCHours(),(x(),D)[l+12>>>2>>>0]=a.getUTCDate(),(x(),D)[l+16>>>2>>>0]=a.getUTCMonth(),(x(),D)[l+20>>>2>>>0]=a.getUTCFullYear()-1900,(x(),D)[l+24>>>2>>>0]=a.getUTCDay(),a=(a.getTime()-Date.UTC(a.getUTCFullYear(),0,1,0,0,0,0))/864e5|0,(x(),D)[l+28>>>2>>>0]=a}var Ei=a=>a%4==0&&(a%100!=0||a%400==0),ki=[0,31,60,91,121,152,182,213,244,274,305,335],Pi=[0,31,59,90,120,151,181,212,243,273,304,334];function Um(a,l){a=-9007199254740992>a||9007199254740992<a?NaN:Number(a),l>>>=0,a=new Date(1e3*a),(x(),D)[l>>>2>>>0]=a.getSeconds(),(x(),D)[l+4>>>2>>>0]=a.getMinutes(),(x(),D)[l+8>>>2>>>0]=a.getHours(),(x(),D)[l+12>>>2>>>0]=a.getDate(),(x(),D)[l+16>>>2>>>0]=a.getMonth(),(x(),D)[l+20>>>2>>>0]=a.getFullYear()-1900,(x(),D)[l+24>>>2>>>0]=a.getDay();var h=(Ei(a.getFullYear())?ki:Pi)[a.getMonth()]+a.getDate()-1|0;(x(),D)[l+28>>>2>>>0]=h,(x(),D)[l+36>>>2>>>0]=-60*a.getTimezoneOffset(),h=new Date(a.getFullYear(),6,1).getTimezoneOffset();var m=new Date(a.getFullYear(),0,1).getTimezoneOffset();a=0|(h!=m&&a.getTimezoneOffset()==Math.min(m,h)),(x(),D)[l+32>>>2>>>0]=a}function Nm(a){a>>>=0;var l=new Date((x(),D)[a+20>>>2>>>0]+1900,(x(),D)[a+16>>>2>>>0],(x(),D)[a+12>>>2>>>0],(x(),D)[a+8>>>2>>>0],(x(),D)[a+4>>>2>>>0],(x(),D)[a>>>2>>>0],0),h=(x(),D)[a+32>>>2>>>0],m=l.getTimezoneOffset(),v=new Date(l.getFullYear(),6,1).getTimezoneOffset(),A=new Date(l.getFullYear(),0,1).getTimezoneOffset(),P=Math.min(A,v);return 0>h?(x(),D)[a+32>>>2>>>0]=+(v!=A&&P==m):0<h!=(P==m)&&(v=Math.max(A,v),l.setTime(l.getTime()+6e4*((0<h?P:v)-m))),(x(),D)[a+24>>>2>>>0]=l.getDay(),h=(Ei(l.getFullYear())?ki:Pi)[l.getMonth()]+l.getDate()-1|0,(x(),D)[a+28>>>2>>>0]=h,(x(),D)[a>>>2>>>0]=l.getSeconds(),(x(),D)[a+4>>>2>>>0]=l.getMinutes(),(x(),D)[a+8>>>2>>>0]=l.getHours(),(x(),D)[a+12>>>2>>>0]=l.getDate(),(x(),D)[a+16>>>2>>>0]=l.getMonth(),(x(),D)[a+20>>>2>>>0]=l.getYear(),a=l.getTime(),BigInt(isNaN(a)?-1:a/1e3)}function Oi(a,l,h,m,v,A,P){return o?ge(16,1,a,l,h,m,v,A,P):-52}function Di(a,l,h,m,v,A){if(o)return ge(17,1,a,l,h,m,v,A)}var nr={},Vm=()=>performance.timeOrigin+performance.now();function Bi(a,l){if(o)return ge(18,1,a,l);if(nr[a]&&(clearTimeout(nr[a].id),delete nr[a]),!l)return 0;var h=setTimeout(()=>{delete nr[a],$r(()=>Qi(a,performance.timeOrigin+performance.now()))},l);return nr[a]={id:h,me:l},0}function Lm(a,l,h,m){a>>>=0,l>>>=0,h>>>=0,m>>>=0;var v=new Date().getFullYear(),A=new Date(v,0,1).getTimezoneOffset();v=new Date(v,6,1).getTimezoneOffset();var P=Math.max(A,v);(x(),j)[a>>>2>>>0]=60*P,(x(),D)[l>>>2>>>0]=+(A!=v),a=(l=z=>{var H=Math.abs(z);return`UTC${0<=z?"-":"+"}${String(Math.floor(H/60)).padStart(2,"0")}${String(H%60).padStart(2,"0")}`})(A),l=l(v),v<A?(bt(a,h,17),bt(l,m,17)):(bt(a,m,17),bt(l,h,17))}var Wm=()=>Date.now(),Gm=1;function Hm(a,l,h){if(h>>>=0,!(0<=a&&3>=a))return 28;if(a===0)a=Date.now();else{if(!Gm)return 52;a=performance.timeOrigin+performance.now()}return a=Math.round(1e6*a),(x(),J)[h>>>3>>>0]=BigInt(a),0}var Gn=[],zi=(a,l)=>{Gn.length=0;for(var h;h=(x(),F)[a++>>>0];){var m=h!=105;l+=(m&=h!=112)&&l%8?4:0,Gn.push(h==112?(x(),j)[l>>>2>>>0]:h==106?(x(),J)[l>>>3>>>0]:h==105?(x(),D)[l>>>2>>>0]:(x(),L)[l>>>3>>>0]),l+=m?8:4}return Gn};function Fm(a,l,h){return a>>>=0,l=zi(l>>>0,h>>>0),Yn[a](...l)}function qm(a,l,h){return a>>>=0,l=zi(l>>>0,h>>>0),Yn[a](...l)}var Km=()=>{};function jm(a,l){return C(Oe(a>>>0,l>>>0))}var Zm=()=>{throw xe+=1,"unwind"};function Qm(){return 4294901760}var Ym=()=>navigator.hardwareConcurrency,Ot={},Ar=a=>{var l;return(l=/\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(a))?+l[1]:(l=/:(\d+):\d+(?:\)|$)/.exec(a))?2147483648|+l[1]:0},Mi=a=>{for(var l of a)(a=Ar(l))&&(Ot[a]=l)};function Xm(){var a=Error().stack.toString().split(`
`);return a[0]=="Error"&&a.shift(),Mi(a),Ot.sd=Ar(a[3]),Ot.Ud=a,Ot.sd}function Cr(a){if(!(a=Ot[a>>>0]))return 0;var l;if(l=/^\s+at .*\.wasm\.(.*) \(.*\)$/.exec(a))a=l[1];else if(l=/^\s+at (.*) \(.*\)$/.exec(a))a=l[1];else{if(!(l=/^(.+?)@/.exec(a)))return 0;a=l[1]}tt(Cr.td??0),l=vr(a)+1;var h=or(l);return h&&bt(a,h,l),Cr.td=h,Cr.td}function Jm(a){a>>>=0;var l=(x(),F).length;if(a<=l||4294901760<a)return!1;for(var h=1;4>=h;h*=2){var m=l*(1+.2/h);m=Math.min(m,a+100663296);e:{m=(Math.min(4294901760,65536*Math.ceil(Math.max(a,m)/65536))-yt.buffer.byteLength+65535)/65536|0;try{yt.grow(m),fe();var v=1;break e}catch{}v=void 0}if(v)return!0}return!1}function ef(a,l,h){if(a>>>=0,l>>>=0,Ot.sd==a)var m=Ot.Ud;else(m=Error().stack.toString().split(`
`))[0]=="Error"&&m.shift(),Mi(m);for(var v=3;m[v]&&Ar(m[v])!=a;)++v;for(a=0;a<h&&m[a+v];++a)(x(),D)[l+4*a>>>2>>>0]=Ar(m[a+v]);return a}var Hn,Fn={},Ri=()=>{if(!Hn){var a,l={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:(globalThis.navigator?.language??"C").replace("-","_")+".UTF-8",_:"./this.program"};for(a in Fn)Fn[a]===void 0?delete l[a]:l[a]=Fn[a];var h=[];for(a in l)h.push(`${a}=${l[a]}`);Hn=h}return Hn};function Ui(a,l){if(o)return ge(19,1,a,l);a>>>=0,l>>>=0;var h,m=0,v=0;for(h of Ri()){var A=l+m;(x(),j)[a+v>>>2>>>0]=A,m+=bt(h,A,1/0)+1,v+=4}return 0}function Ni(a,l){if(o)return ge(20,1,a,l);a>>>=0,l>>>=0;var h=Ri();for(var m of((x(),j)[a>>>2>>>0]=h.length,a=0,h))a+=vr(m)+1;return(x(),j)[l>>>2>>>0]=a,0}function Vi(a){return o?ge(21,1,a):52}function Li(a,l,h,m,v){return o?ge(22,1,a,l,h,m,v):52}function Wi(a,l,h,m){return o?ge(23,1,a,l,h,m):52}function Gi(a,l,h,m){return o?ge(24,1,a,l,h,m):70}var tf=[null,[],[]];function Hi(a,l,h,m){if(o)return ge(25,1,a,l,h,m);l>>>=0,h>>>=0,m>>>=0;for(var v=0,A=0;A<h;A++){var P=(x(),j)[l>>>2>>>0],z=(x(),j)[l+4>>>2>>>0];l+=8;for(var H=0;H<z;H++){var q=a,ie=(x(),F)[P+H>>>0],ye=tf[q];ie===0||ie===10?((q===1?I:C)(si(ye)),ye.length=0):ye.push(ie)}v+=z}return(x(),j)[m>>>2>>>0]=v,0}function rf(a){return a>>>0}o||(function(){for(var a=e.numThreads-1;a--;)ei();ke.push(async()=>{var l=(async function(){if(!o)return Promise.all(gt.map(Jo))})();Ce++,await l,--Ce==0&&qe&&(l=qe,qe=null,l())})})(),o||(yt=new WebAssembly.Memory({initial:256,maximum:65536,shared:!0}),fe()),e.wasmBinary&&(g=e.wasmBinary),e.stackSave=()=>de(),e.stackRestore=a=>se(a),e.stackAlloc=a=>jn(a),e.setValue=function(a,l,h="i8"){switch(h.endsWith("*")&&(h="*"),h){case"i1":case"i8":(x(),N)[a>>>0]=l;break;case"i16":(x(),Z)[a>>>1>>>0]=l;break;case"i32":(x(),D)[a>>>2>>>0]=l;break;case"i64":(x(),J)[a>>>3>>>0]=BigInt(l);break;case"float":(x(),Y)[a>>>2>>>0]=l;break;case"double":(x(),L)[a>>>3>>>0]=l;break;case"*":(x(),j)[a>>>2>>>0]=l;break;default:M(`invalid type for setValue: ${h}`)}},e.getValue=function(a,l="i8"){switch(l.endsWith("*")&&(l="*"),l){case"i1":case"i8":return(x(),N)[a>>>0];case"i16":return(x(),Z)[a>>>1>>>0];case"i32":return(x(),D)[a>>>2>>>0];case"i64":return(x(),J)[a>>>3>>>0];case"float":return(x(),Y)[a>>>2>>>0];case"double":return(x(),L)[a>>>3>>>0];case"*":return(x(),j)[a>>>2>>>0];default:M(`invalid type for getValue: ${l}`)}},e.UTF8ToString=Oe,e.stringToUTF8=bt,e.lengthBytesUTF8=vr;var Fi,qi,Er,tt,or,qn,Ki,ji,Zi,Kn,Qi,Yi,ce,ir,Xi,se,jn,de,Ji,Zn,ea,ta,ra,Qn,na,oa,ia,aa,sa,ua,da,la,ca,pa,ma,fa,ha,ga,ya,ba,_a,wa,va,$a,xa,Sa,Ta,Ia,Aa,Ca,Ea,ka,Pa,Oa,Da,Ba,za,Ma,Ra,Ua,Na,Va,La,Wa,Ga,ct,nf=[ht,tr,ni,ui,di,li,ci,pi,mi,fi,hi,gi,yi,bi,_i,wi,Oi,Di,Bi,Ui,Ni,Vi,Li,Wi,Gi,Hi],Yn={1124124:(a,l,h,m,v)=>{if(e===void 0||!e.jd)return 1;if((a=Oe(Number(a>>>0))).startsWith("./")&&(a=a.substring(2)),!(a=e.jd.get(a)))return 2;if(l=Number(l>>>0),h=Number(h>>>0),m=Number(m>>>0),l+h>a.byteLength)return 3;try{let A=a.subarray(l,l+h);switch(v){case 0:(x(),F).set(A,m>>>0);break;case 1:e.ae?e.ae(m,A):e.Td(m,A);break;default:return 4}return 0}catch{return 4}},1124948:()=>typeof navigator<"u"&&navigator.de?1:0,1125020:(a,l,h)=>{e.Dd(a,(x(),F).subarray(l>>>0,l+h>>>0))},1125084:()=>e.ce(),1125126:a=>{e.Cd(a)},1125163:()=>{e.Md()},1125194:()=>{e.Nd()},1125223:()=>{e.Rd()},1125248:a=>e.Ld(a),1125281:a=>e.Pd(a),1125313:(a,l,h)=>{e.rd(Number(a),Number(l),Number(h),!0)},1125376:(a,l,h)=>{e.rd(Number(a),Number(l),Number(h))},1125433:()=>typeof wasmOffsetConverter<"u",1125490:a=>{e.ic("Abs",a,void 0)},1125541:a=>{e.ic("Neg",a,void 0)},1125592:a=>{e.ic("Floor",a,void 0)},1125645:a=>{e.ic("Ceil",a,void 0)},1125697:a=>{e.ic("Reciprocal",a,void 0)},1125755:a=>{e.ic("Sqrt",a,void 0)},1125807:a=>{e.ic("Exp",a,void 0)},1125858:a=>{e.ic("Erf",a,void 0)},1125909:a=>{e.ic("Sigmoid",a,void 0)},1125964:(a,l,h)=>{e.ic("HardSigmoid",a,{alpha:l,beta:h})},1126043:a=>{e.ic("HardSwish",a,void 0)},1126100:a=>{e.ic("Log",a,void 0)},1126151:a=>{e.ic("Sin",a,void 0)},1126202:a=>{e.ic("Cos",a,void 0)},1126253:a=>{e.ic("Tan",a,void 0)},1126304:a=>{e.ic("Asin",a,void 0)},1126356:a=>{e.ic("Acos",a,void 0)},1126408:a=>{e.ic("Atan",a,void 0)},1126460:a=>{e.ic("Sinh",a,void 0)},1126512:a=>{e.ic("Cosh",a,void 0)},1126564:a=>{e.ic("Asinh",a,void 0)},1126617:a=>{e.ic("Acosh",a,void 0)},1126670:a=>{e.ic("Atanh",a,void 0)},1126723:a=>{e.ic("Tanh",a,void 0)},1126775:a=>{e.ic("Not",a,void 0)},1126826:(a,l,h)=>{e.ic("Clip",a,{min:l,max:h})},1126895:a=>{e.ic("Clip",a,void 0)},1126947:(a,l)=>{e.ic("Elu",a,{alpha:l})},1127005:a=>{e.ic("Gelu",a,void 0)},1127057:a=>{e.ic("Relu",a,void 0)},1127109:(a,l)=>{e.ic("LeakyRelu",a,{alpha:l})},1127173:(a,l)=>{e.ic("ThresholdedRelu",a,{alpha:l})},1127243:(a,l)=>{e.ic("Cast",a,{to:l})},1127301:a=>{e.ic("Add",a,void 0)},1127352:a=>{e.ic("Sub",a,void 0)},1127403:a=>{e.ic("Mul",a,void 0)},1127454:a=>{e.ic("Div",a,void 0)},1127505:a=>{e.ic("Pow",a,void 0)},1127556:a=>{e.ic("Equal",a,void 0)},1127609:a=>{e.ic("Greater",a,void 0)},1127664:a=>{e.ic("GreaterOrEqual",a,void 0)},1127726:a=>{e.ic("Less",a,void 0)},1127778:a=>{e.ic("LessOrEqual",a,void 0)},1127837:(a,l,h,m,v)=>{e.ic("ReduceMean",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1128012:(a,l,h,m,v)=>{e.ic("ReduceMax",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1128186:(a,l,h,m,v)=>{e.ic("ReduceMin",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1128360:(a,l,h,m,v)=>{e.ic("ReduceProd",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1128535:(a,l,h,m,v)=>{e.ic("ReduceSum",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1128709:(a,l,h,m,v)=>{e.ic("ReduceL1",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1128882:(a,l,h,m,v)=>{e.ic("ReduceL2",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1129055:(a,l,h,m,v)=>{e.ic("ReduceLogSum",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1129232:(a,l,h,m,v)=>{e.ic("ReduceSumSquare",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1129412:(a,l,h,m,v)=>{e.ic("ReduceLogSumExp",a,{keepDims:!!l,noopWithEmptyAxes:!!h,axes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1129592:a=>{e.ic("Where",a,void 0)},1129645:(a,l,h)=>{e.ic("Transpose",a,{perm:l?Array.from((x(),D).subarray(Number(l)>>>0,Number(h)>>>0)):[]})},1129769:(a,l,h,m)=>{e.ic("DepthToSpace",a,{blocksize:l,mode:Oe(h),format:m?"NHWC":"NCHW"})},1129902:(a,l,h,m)=>{e.ic("DepthToSpace",a,{blocksize:l,mode:Oe(h),format:m?"NHWC":"NCHW"})},1130035:(a,l,h,m)=>{e.ic("DFT",a,{axis:l,inverse:h,onesided:m})},1130127:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te,wt)=>{e.ic("ConvTranspose",a,{format:H?"NHWC":"NCHW",autoPad:l,dilations:[h],group:m,kernelShape:[v],pads:[A,P],strides:[z],wIsConst:()=>!!(x(),N)[q>>>0],outputPadding:ie?Array.from((x(),D).subarray(Number(ie)>>>0,Number(ye)>>>0)):[],outputShape:Se?Array.from((x(),D).subarray(Number(Se)>>>0,Number(Te)>>>0)):[],activation:Oe(wt)})},1130560:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te)=>{e.ic("ConvTranspose",a,{format:z?"NHWC":"NCHW",autoPad:l,dilations:Array.from((x(),D).subarray(Number(h)>>>0,(Number(h)>>>0)+2>>>0)),group:m,kernelShape:Array.from((x(),D).subarray(Number(v)>>>0,(Number(v)>>>0)+2>>>0)),pads:Array.from((x(),D).subarray(Number(A)>>>0,(Number(A)>>>0)+4>>>0)),strides:Array.from((x(),D).subarray(Number(P)>>>0,(Number(P)>>>0)+2>>>0)),wIsConst:()=>!!(x(),N)[H>>>0],outputPadding:q?Array.from((x(),D).subarray(Number(q)>>>0,Number(ie)>>>0)):[],outputShape:ye?Array.from((x(),D).subarray(Number(ye)>>>0,Number(Se)>>>0)):[],activation:Oe(Te)})},1131221:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te,wt)=>{e.ic("ConvTranspose",a,{format:H?"NHWC":"NCHW",autoPad:l,dilations:[h],group:m,kernelShape:[v],pads:[A,P],strides:[z],wIsConst:()=>!!(x(),N)[q>>>0],outputPadding:ie?Array.from((x(),D).subarray(Number(ie)>>>0,Number(ye)>>>0)):[],outputShape:Se?Array.from((x(),D).subarray(Number(Se)>>>0,Number(Te)>>>0)):[],activation:Oe(wt)})},1131654:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te)=>{e.ic("ConvTranspose",a,{format:z?"NHWC":"NCHW",autoPad:l,dilations:Array.from((x(),D).subarray(Number(h)>>>0,(Number(h)>>>0)+2>>>0)),group:m,kernelShape:Array.from((x(),D).subarray(Number(v)>>>0,(Number(v)>>>0)+2>>>0)),pads:Array.from((x(),D).subarray(Number(A)>>>0,(Number(A)>>>0)+4>>>0)),strides:Array.from((x(),D).subarray(Number(P)>>>0,(Number(P)>>>0)+2>>>0)),wIsConst:()=>!!(x(),N)[H>>>0],outputPadding:q?Array.from((x(),D).subarray(Number(q)>>>0,Number(ie)>>>0)):[],outputShape:ye?Array.from((x(),D).subarray(Number(ye)>>>0,Number(Se)>>>0)):[],activation:Oe(Te)})},1132315:(a,l)=>{e.ic("GlobalAveragePool",a,{format:l?"NHWC":"NCHW"})},1132406:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te)=>{e.ic("AveragePool",a,{format:Te?"NHWC":"NCHW",auto_pad:l,ceil_mode:h,count_include_pad:m,storage_order:v,dilations:A?Array.from((x(),D).subarray(Number(A)>>>0,Number(P)>>>0)):[],kernel_shape:z?Array.from((x(),D).subarray(Number(z)>>>0,Number(H)>>>0)):[],pads:q?Array.from((x(),D).subarray(Number(q)>>>0,Number(ie)>>>0)):[],strides:ye?Array.from((x(),D).subarray(Number(ye)>>>0,Number(Se)>>>0)):[]})},1132885:(a,l)=>{e.ic("GlobalAveragePool",a,{format:l?"NHWC":"NCHW"})},1132976:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te)=>{e.ic("AveragePool",a,{format:Te?"NHWC":"NCHW",auto_pad:l,ceil_mode:h,count_include_pad:m,storage_order:v,dilations:A?Array.from((x(),D).subarray(Number(A)>>>0,Number(P)>>>0)):[],kernel_shape:z?Array.from((x(),D).subarray(Number(z)>>>0,Number(H)>>>0)):[],pads:q?Array.from((x(),D).subarray(Number(q)>>>0,Number(ie)>>>0)):[],strides:ye?Array.from((x(),D).subarray(Number(ye)>>>0,Number(Se)>>>0)):[]})},1133455:(a,l)=>{e.ic("GlobalMaxPool",a,{format:l?"NHWC":"NCHW"})},1133542:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te)=>{e.ic("MaxPool",a,{format:Te?"NHWC":"NCHW",auto_pad:l,ceil_mode:h,count_include_pad:m,storage_order:v,dilations:A?Array.from((x(),D).subarray(Number(A)>>>0,Number(P)>>>0)):[],kernel_shape:z?Array.from((x(),D).subarray(Number(z)>>>0,Number(H)>>>0)):[],pads:q?Array.from((x(),D).subarray(Number(q)>>>0,Number(ie)>>>0)):[],strides:ye?Array.from((x(),D).subarray(Number(ye)>>>0,Number(Se)>>>0)):[]})},1134017:(a,l)=>{e.ic("GlobalMaxPool",a,{format:l?"NHWC":"NCHW"})},1134104:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te)=>{e.ic("MaxPool",a,{format:Te?"NHWC":"NCHW",auto_pad:l,ceil_mode:h,count_include_pad:m,storage_order:v,dilations:A?Array.from((x(),D).subarray(Number(A)>>>0,Number(P)>>>0)):[],kernel_shape:z?Array.from((x(),D).subarray(Number(z)>>>0,Number(H)>>>0)):[],pads:q?Array.from((x(),D).subarray(Number(q)>>>0,Number(ie)>>>0)):[],strides:ye?Array.from((x(),D).subarray(Number(ye)>>>0,Number(Se)>>>0)):[]})},1134579:(a,l,h,m,v)=>{e.ic("Gemm",a,{alpha:l,beta:h,transA:m,transB:v})},1134683:a=>{e.ic("MatMul",a,void 0)},1134737:(a,l,h,m)=>{e.ic("ArgMax",a,{keepDims:!!l,selectLastIndex:!!h,axis:m})},1134845:(a,l,h,m)=>{e.ic("ArgMin",a,{keepDims:!!l,selectLastIndex:!!h,axis:m})},1134953:(a,l)=>{e.ic("Softmax",a,{axis:l})},1135016:(a,l)=>{e.ic("Concat",a,{axis:l})},1135076:(a,l,h,m,v)=>{e.ic("Split",a,{axis:l,numOutputs:h,splitSizes:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1135232:a=>{e.ic("Expand",a,void 0)},1135286:(a,l)=>{e.ic("Gather",a,{axis:Number(l)})},1135357:(a,l)=>{e.ic("GatherElements",a,{axis:Number(l)})},1135436:(a,l)=>{e.ic("GatherND",a,{batch_dims:Number(l)})},1135515:(a,l,h,m,v,A,P,z,H,q,ie)=>{e.ic("Resize",a,{antialias:l,axes:h?Array.from((x(),D).subarray(Number(h)>>>0,Number(m)>>>0)):[],coordinateTransformMode:Oe(v),cubicCoeffA:A,excludeOutside:P,extrapolationValue:z,keepAspectRatioPolicy:Oe(H),mode:Oe(q),nearestMode:Oe(ie)})},1135877:(a,l,h,m,v,A,P)=>{e.ic("Slice",a,{starts:l?Array.from((x(),D).subarray(Number(l)>>>0,Number(h)>>>0)):[],ends:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[],axes:A?Array.from((x(),D).subarray(Number(A)>>>0,Number(P)>>>0)):[]})},1136141:a=>{e.ic("Tile",a,void 0)},1136193:(a,l,h)=>{e.ic("InstanceNormalization",a,{epsilon:l,format:h?"NHWC":"NCHW"})},1136307:(a,l,h)=>{e.ic("InstanceNormalization",a,{epsilon:l,format:h?"NHWC":"NCHW"})},1136421:a=>{e.ic("Range",a,void 0)},1136474:(a,l)=>{e.ic("Einsum",a,{equation:Oe(l)})},1136555:(a,l,h,m,v)=>{e.ic("Pad",a,{mode:l,value:h,pads:m?Array.from((x(),D).subarray(Number(m)>>>0,Number(v)>>>0)):[]})},1136698:(a,l,h,m,v,A)=>{e.ic("BatchNormalization",a,{epsilon:l,momentum:h,spatial:!!v,trainingMode:!!m,format:A?"NHWC":"NCHW"})},1136867:(a,l,h,m,v,A)=>{e.ic("BatchNormalization",a,{epsilon:l,momentum:h,spatial:!!v,trainingMode:!!m,format:A?"NHWC":"NCHW"})},1137036:(a,l,h)=>{e.ic("CumSum",a,{exclusive:Number(l),reverse:Number(h)})},1137133:(a,l,h)=>{e.ic("DequantizeLinear",a,{axis:l,blockSize:h})},1137223:(a,l,h,m,v)=>{e.ic("GridSample",a,{align_corners:l,mode:Oe(h),padding_mode:Oe(m),format:v?"NHWC":"NCHW"})},1137393:(a,l,h,m,v)=>{e.ic("GridSample",a,{align_corners:l,mode:Oe(h),padding_mode:Oe(m),format:v?"NHWC":"NCHW"})},1137563:(a,l)=>{e.ic("ScatterND",a,{reduction:Oe(l)})},1137648:(a,l,h,m,v,A,P,z,H)=>{e.ic("Attention",a,{numHeads:l,isUnidirectional:h,maskFilterValue:m,scale:v,doRotary:A,qkvHiddenSizes:P?Array.from((x(),D).subarray(Number(z)>>>0,Number(z)+P>>>0)):[],pastPresentShareBuffer:!!H})},1137920:a=>{e.ic("BiasAdd",a,void 0)},1137975:a=>{e.ic("BiasSplitGelu",a,void 0)},1138036:a=>{e.ic("FastGelu",a,void 0)},1138092:(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te,wt,Xn)=>{e.ic("Conv",a,{format:ye?"NHWC":"NCHW",auto_pad:l,dilations:h?Array.from((x(),D).subarray(Number(h)>>>0,Number(m)>>>0)):[],group:v,kernel_shape:A?Array.from((x(),D).subarray(Number(A)>>>0,Number(P)>>>0)):[],pads:z?Array.from((x(),D).subarray(Number(z)>>>0,Number(H)>>>0)):[],strides:q?Array.from((x(),D).subarray(Number(q)>>>0,Number(ie)>>>0)):[],w_is_const:()=>!!(x(),N)[Number(Se)>>>0],activation:Oe(Te),activation_params:wt?Array.from((x(),Y).subarray(Number(wt)>>>0,Number(Xn)>>>0)):[]})},1138676:a=>{e.ic("Gelu",a,void 0)},1138728:(a,l,h,m,v,A,P,z,H)=>{e.ic("GroupQueryAttention",a,{numHeads:l,kvNumHeads:h,scale:m,softcap:v,doRotary:A,rotaryInterleaved:P,smoothSoftmax:z,localWindowSize:H})},1138945:(a,l,h,m)=>{e.ic("LayerNormalization",a,{axis:l,epsilon:h,simplified:!!m})},1139056:(a,l,h,m)=>{e.ic("LayerNormalization",a,{axis:l,epsilon:h,simplified:!!m})},1139167:(a,l,h,m,v,A)=>{e.ic("MatMulNBits",a,{k:l,n:h,accuracyLevel:m,bits:v,blockSize:A})},1139294:(a,l,h,m,v,A)=>{e.ic("MultiHeadAttention",a,{numHeads:l,isUnidirectional:h,maskFilterValue:m,scale:v,doRotary:A})},1139453:(a,l)=>{e.ic("QuickGelu",a,{alpha:l})},1139517:(a,l,h,m,v)=>{e.ic("RotaryEmbedding",a,{interleaved:!!l,numHeads:h,rotaryEmbeddingDim:m,scale:v})},1139656:(a,l,h)=>{e.ic("SkipLayerNormalization",a,{epsilon:l,simplified:!!h})},1139758:(a,l,h)=>{e.ic("SkipLayerNormalization",a,{epsilon:l,simplified:!!h})},1139860:(a,l,h,m)=>{e.ic("GatherBlockQuantized",a,{gatherAxis:l,quantizeAxis:h,blockSize:m})},1139981:a=>{e.Qd(a)},1140015:(a,l)=>e.Sd(Number(a),Number(l),e.hd.Vd,e.hd.errors)};function of(a,l,h){return Ai(async()=>{await e.Od(Number(a),Number(l),Number(h))})}function af(){return typeof wasmOffsetConverter<"u"}function sf(a,l,h,m){var v=de();try{return ca(a,l,h,m)}catch(A){if(se(v),A!==A+0)throw A;ce(1,0)}}function uf(a,l,h){var m=de();try{return da(a,l,h)}catch(v){if(se(m),v!==v+0)throw v;ce(1,0)}}function df(a){var l=de();try{sa(a)}catch(h){if(se(l),h!==h+0)throw h;ce(1,0)}}function lf(a,l){var h=de();try{return Qn(a,l)}catch(m){if(se(h),m!==m+0)throw m;ce(1,0)}}function cf(a,l,h){var m=de();try{ra(a,l,h)}catch(v){if(se(m),v!==v+0)throw v;ce(1,0)}}function pf(a,l,h,m){var v=de();try{return ga(a,l,h,m)}catch(A){if(se(v),A!==A+0)throw A;ce(1,0)}}function mf(a,l){var h=de();try{pa(a,l)}catch(m){if(se(h),m!==m+0)throw m;ce(1,0)}}function ff(a,l,h,m,v,A,P){var z=de();try{return la(a,l,h,m,v,A,P)}catch(H){if(se(z),H!==H+0)throw H;ce(1,0)}}function hf(a,l,h,m,v,A){var P=de();try{na(a,l,h,m,v,A)}catch(z){if(se(P),z!==z+0)throw z;ce(1,0)}}function gf(a,l,h,m){var v=de();try{ia(a,l,h,m)}catch(A){if(se(v),A!==A+0)throw A;ce(1,0)}}function yf(a,l,h,m,v){var A=de();try{ua(a,l,h,m,v)}catch(P){if(se(A),P!==P+0)throw P;ce(1,0)}}function bf(a,l,h,m,v,A,P){var z=de();try{fa(a,l,h,m,v,A,P)}catch(H){if(se(z),H!==H+0)throw H;ce(1,0)}}function _f(a,l,h,m,v,A,P){var z=de();try{ha(a,l,h,m,v,A,P)}catch(H){if(se(z),H!==H+0)throw H;ce(1,0)}}function wf(a,l,h,m,v,A,P,z){var H=de();try{wa(a,l,h,m,v,A,P,z)}catch(q){if(se(H),q!==q+0)throw q;ce(1,0)}}function vf(a,l,h,m,v){var A=de();try{return ma(a,l,h,m,v)}catch(P){if(se(A),P!==P+0)throw P;ce(1,0)}}function $f(a,l,h){var m=de();try{return aa(a,l,h)}catch(v){if(se(m),v!==v+0)throw v;ce(1,0)}}function xf(a,l,h,m,v,A,P,z){var H=de();try{va(a,l,h,m,v,A,P,z)}catch(q){if(se(H),q!==q+0)throw q;ce(1,0)}}function Sf(a,l,h,m,v,A,P,z,H,q,ie,ye){var Se=de();try{ya(a,l,h,m,v,A,P,z,H,q,ie,ye)}catch(Te){if(se(Se),Te!==Te+0)throw Te;ce(1,0)}}function Tf(a,l,h){var m=de();try{return $a(a,l,h)}catch(v){if(se(m),v!==v+0)throw v;return ce(1,0),0n}}function If(a,l,h,m,v,A,P,z,H){var q=de();try{oa(a,l,h,m,v,A,P,z,H)}catch(ie){if(se(q),ie!==ie+0)throw ie;ce(1,0)}}function Af(a){var l=de();try{return xa(a)}catch(h){if(se(l),h!==h+0)throw h;ce(1,0)}}function Cf(a,l){var h=de();try{return Ua(a,l)}catch(m){if(se(h),m!==m+0)throw m;return ce(1,0),0n}}function Ef(a,l,h,m){var v=de();try{return Sa(a,l,h,m)}catch(A){if(se(v),A!==A+0)throw A;ce(1,0)}}function kf(a,l,h,m,v,A,P){var z=de();try{Na(a,l,h,m,v,A,P)}catch(H){if(se(z),H!==H+0)throw H;ce(1,0)}}function Pf(a){var l=de();try{return Ta(a)}catch(h){if(se(l),h!==h+0)throw h;return ce(1,0),0n}}function Of(a,l,h,m,v){var A=de();try{return Pa(a,l,h,m,v)}catch(P){if(se(A),P!==P+0)throw P;ce(1,0)}}function Df(a,l,h,m,v,A){var P=de();try{return Oa(a,l,h,m,v,A)}catch(z){if(se(P),z!==z+0)throw z;ce(1,0)}}function Bf(a,l,h,m,v,A){var P=de();try{return ba(a,l,h,m,v,A)}catch(z){if(se(P),z!==z+0)throw z;ce(1,0)}}function zf(a,l,h,m,v,A){var P=de();try{return Da(a,l,h,m,v,A)}catch(z){if(se(P),z!==z+0)throw z;ce(1,0)}}function Mf(a,l,h,m,v,A,P,z){var H=de();try{return _a(a,l,h,m,v,A,P,z)}catch(q){if(se(H),q!==q+0)throw q;ce(1,0)}}function Rf(a,l,h,m,v){var A=de();try{return Ba(a,l,h,m,v)}catch(P){if(se(A),P!==P+0)throw P;return ce(1,0),0n}}function Uf(a,l,h,m){var v=de();try{return za(a,l,h,m)}catch(A){if(se(v),A!==A+0)throw A;ce(1,0)}}function Nf(a,l,h,m){var v=de();try{return Ma(a,l,h,m)}catch(A){if(se(v),A!==A+0)throw A;ce(1,0)}}function Vf(a,l,h,m,v,A,P,z,H,q,ie,ye){var Se=de();try{return Ra(a,l,h,m,v,A,P,z,H,q,ie,ye)}catch(Te){if(se(Se),Te!==Te+0)throw Te;ce(1,0)}}function Lf(a,l,h,m,v,A,P,z,H,q,ie){var ye=de();try{Ea(a,l,h,m,v,A,P,z,H,q,ie)}catch(Se){if(se(ye),Se!==Se+0)throw Se;ce(1,0)}}function Wf(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te,wt,Xn){var qf=de();try{ka(a,l,h,m,v,A,P,z,H,q,ie,ye,Se,Te,wt,Xn)}catch(Jn){if(se(qf),Jn!==Jn+0)throw Jn;ce(1,0)}}function Gf(a,l,h){var m=de();try{return Ia(a,l,h)}catch(v){if(se(m),v!==v+0)throw v;ce(1,0)}}function Hf(a,l,h){var m=de();try{return Aa(a,l,h)}catch(v){if(se(m),v!==v+0)throw v;ce(1,0)}}function Ff(a,l,h,m){var v=de();try{Ca(a,l,h,m)}catch(A){if(se(v),A!==A+0)throw A;ce(1,0)}}function kr(){if(0<Ce)qe=kr;else if(o)$?.(e),ue();else{for(var a=ke;0<a.length;)a.shift()(e);0<Ce?qe=kr:(e.calledRun=!0,E||(ue(),$?.(e)))}}return o||(ct=await he(),kr()),e.PTR_SIZE=4,be?e:new Promise((a,l)=>{$=a,T=l})}var eh,th,Es=V(()=>{"use strict";eh=As,th=globalThis.self?.name?.startsWith("em-pthread");th&&As()});var Os,lo,rh,We,Ds,uo,nh,oh,Bs,ih,ks,zs,Ps,Ms,Rr=V(()=>{"use strict";Mr();Os=typeof location>"u"?void 0:location.origin,lo=import.meta.url>"file:"&&import.meta.url<"file;",rh=()=>{if(!!1){if(lo){let t=URL;return new URL(new t("ort.bundle.min.mjs",import.meta.url).href,Os).href}return import.meta.url}},We=rh(),Ds=()=>{if(We&&!We.startsWith("blob:"))return We.substring(0,We.lastIndexOf("/")+1)},uo=(t,e)=>{try{let r=e??We;return(r?new URL(t,r):new URL(t)).origin===Os}catch{return!1}},nh=(t,e)=>{let r=e??We;try{return(r?new URL(t,r):new URL(t)).href}catch{return}},oh=(t,e)=>`${e??"./"}${t}`,Bs=async t=>{let r=await(await fetch(t,{credentials:"same-origin"})).blob();return URL.createObjectURL(r)},ih=async t=>(await import(/*webpackIgnore:true*/ /*@vite-ignore*/t)).default,ks=(Is(),ar(Ts)).default,zs=async()=>{if(!We)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(uo(We))return[void 0,ks()];let t=await Bs(We);return[t,ks(t)]},Ps=(Es(),ar(Cs)).default,Ms=async(t,e,r,n)=>{let o=Ps&&!(t||e);if(o)if(We)o=uo(We)||n&&!r;else if(n&&!r)o=!0;else throw new Error("cannot determine the script source URL.");if(o)return[void 0,Ps];{let i="ort-wasm-simd-threaded.jsep.mjs",u=t??nh(i,e),s=!!1&&r&&u&&!uo(u,e),d=s?await Bs(u):u??oh(i,e);return[s?d:void 0,await ih(d)]}}});var co,po,qr,Rs,ah,sh,uh,Ur,pe,St=V(()=>{"use strict";Rr();po=!1,qr=!1,Rs=!1,ah=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},sh=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},uh=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Ur=async t=>{if(po)return Promise.resolve();if(qr)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Rs)throw new Error("previous call to 'initializeWebAssembly()' failed.");qr=!0;let e=t.initTimeout,r=t.numThreads;if(t.simd!==!1){if(t.simd==="relaxed"){if(!uh())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!sh())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let n=ah();r>1&&!n&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+r+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),t.numThreads=r=1);let o=t.wasmPaths,i=typeof o=="string"?o:void 0,u=o?.mjs,s=u?.href??u,d=o?.wasm,c=d?.href??d,p=t.wasmBinary,[f,g]=await Ms(s,i,r>1,!!p||!!c),b=!1,y=[];if(e>0&&y.push(new Promise($=>{setTimeout(()=>{b=!0,$()},e)})),y.push(new Promise(($,T)=>{let _={numThreads:r};if(p)_.wasmBinary=p,_.locateFile=w=>w;else if(c||i)_.locateFile=w=>c??i+w;else if(s&&s.indexOf("blob:")!==0)_.locateFile=w=>new URL(w,s).href;else if(f){let w=Ds();w&&(_.locateFile=S=>w+S)}g(_).then(w=>{qr=!1,po=!0,co=w,$(),f&&URL.revokeObjectURL(f)},w=>{qr=!1,Rs=!0,T(w)})})),await Promise.race(y),b)throw new Error(`WebAssembly backend initializing failed due to timeout: ${e}ms`)},pe=()=>{if(po&&co)return co;throw new Error("WebAssembly is not initialized yet.")}});var Ge,lr,me,Kr=V(()=>{"use strict";St();Ge=(t,e)=>{let r=pe(),n=r.lengthBytesUTF8(t)+1,o=r._malloc(n);return r.stringToUTF8(t,o,n),e.push(o),o},lr=(t,e,r,n)=>{if(typeof t=="object"&&t!==null){if(r.has(t))throw new Error("Circular reference in options");r.add(t)}Object.entries(t).forEach(([o,i])=>{let u=e?e+o:o;if(typeof i=="object")lr(i,u+".",r,n);else if(typeof i=="string"||typeof i=="number")n(u,i.toString());else if(typeof i=="boolean")n(u,i?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof i}`)})},me=t=>{let e=pe(),r=e.stackSave();try{let n=e.PTR_SIZE,o=e.stackAlloc(2*n);e._OrtGetLastError(o,o+n);let i=Number(e.getValue(o,n===4?"i32":"i64")),u=e.getValue(o+n,"*"),s=u?e.UTF8ToString(u):"";throw new Error(`${t} ERROR_CODE: ${i}, ERROR_MESSAGE: ${s}`)}finally{e.stackRestore(r)}}});var Us,Ns=V(()=>{"use strict";St();Kr();Us=(t,e)=>{let r=pe(),n=0,o=[],i=t||{};try{if(t?.logSeverityLevel===void 0)i.logSeverityLevel=2;else if(typeof t.logSeverityLevel!="number"||!Number.isInteger(t.logSeverityLevel)||t.logSeverityLevel<0||t.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${t.logSeverityLevel}`);if(t?.logVerbosityLevel===void 0)i.logVerbosityLevel=0;else if(typeof t.logVerbosityLevel!="number"||!Number.isInteger(t.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${t.logVerbosityLevel}`);t?.terminate===void 0&&(i.terminate=!1);let u=0;t?.tag!==void 0&&(u=Ge(t.tag,o)),n=r._OrtCreateRunOptions(i.logSeverityLevel,i.logVerbosityLevel,!!i.terminate,u),n===0&&me("Can't create run options."),t?.extra!==void 0&&lr(t.extra,"",new WeakSet,(s,d)=>{let c=Ge(s,o),p=Ge(d,o);r._OrtAddRunConfigEntry(n,c,p)!==0&&me(`Can't set a run config entry: ${s} - ${d}.`)});for(let s of e)r._OrtRunOptionsAddActiveLoraAdapter(n,s)!==0&&me("Can't add an active LoRA adapter.");return[n,o]}catch(u){throw n!==0&&r._OrtReleaseRunOptions(n),o.forEach(s=>r._free(s)),u}}});var dh,lh,ch,qt,ph,Vs,Ls=V(()=>{"use strict";St();Kr();dh=t=>{switch(t){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${t}`)}},lh=t=>{switch(t){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${t}`)}},ch=t=>{t.extra||(t.extra={}),t.extra.session||(t.extra.session={});let e=t.extra.session;e.use_ort_model_bytes_directly||(e.use_ort_model_bytes_directly="1"),t.executionProviders&&t.executionProviders.some(r=>(typeof r=="string"?r:r.name)==="webgpu")&&(t.enableMemPattern=!1)},qt=(t,e,r,n)=>{let o=Ge(e,n),i=Ge(r,n);pe()._OrtAddSessionConfigEntry(t,o,i)!==0&&me(`Can't set a session config entry: ${e} - ${r}.`)},ph=async(t,e,r)=>{let n=e.executionProviders;for(let o of n){let i=typeof o=="string"?o:o.name,u=[],s;switch(i){case"webnn":if(i="WEBNN",qt(t,"session.disable_quant_qdq","1",r),qt(t,"session.disable_qdq_constant_folding","1",r),typeof o!="string"){let b=o?.deviceType;b&&qt(t,"deviceType",b,r)}break;case"webgpu":if(i="JS",typeof o!="string"){let g=o;if(g?.preferredLayout){if(g.preferredLayout!=="NCHW"&&g.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${g.preferredLayout}`);qt(t,"preferredLayout",g.preferredLayout,r)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${i}`)}let d=u.length,c=0,p=0;if(d>0){c=pe()._malloc(d*pe().PTR_SIZE),r.push(c),p=pe()._malloc(d*pe().PTR_SIZE),r.push(p);for(let g=0;g<d;g++)pe().setValue(c+g*pe().PTR_SIZE,u[g][0],"*"),pe().setValue(p+g*pe().PTR_SIZE,u[g][1],"*")}let f;if(s!==void 0){let g=pe()._malloc(pe().PTR_SIZE);r.push(g),pe().setValue(g,s[0],"*"),f=await pe()._OrtAppendExecutionProviderV2(t,g,1,c,p,d)}else{let g=Ge(i,r);f=await pe()._OrtAppendExecutionProvider(t,g,c,p,d)}f!==0&&me(`Can't append execution provider: ${i}.`)}},Vs=async t=>{let e=pe(),r=0,n=[],o=t||{};ch(o);try{let i=dh(o.graphOptimizationLevel??"all"),u=lh(o.executionMode??"sequential"),s=typeof o.logId=="string"?Ge(o.logId,n):0,d=o.logSeverityLevel??2;if(!Number.isInteger(d)||d<0||d>4)throw new Error(`log severity level is not valid: ${d}`);let c=o.logVerbosityLevel??0;if(!Number.isInteger(c)||c<0||c>4)throw new Error(`log verbosity level is not valid: ${c}`);let p=typeof o.optimizedModelFilePath=="string"?Ge(o.optimizedModelFilePath,n):0;if(r=e._OrtCreateSessionOptions(i,!!o.enableCpuMemArena,!!o.enableMemPattern,u,!!o.enableProfiling,0,s,d,c,p),r===0&&me("Can't create session options."),o.executionProviders&&await ph(r,o,n),o.enableGraphCapture!==void 0){if(typeof o.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${o.enableGraphCapture}`);qt(r,"enableGraphCapture",o.enableGraphCapture.toString(),n)}if(o.freeDimensionOverrides)for(let[f,g]of Object.entries(o.freeDimensionOverrides)){if(typeof f!="string")throw new Error(`free dimension override name must be a string: ${f}`);if(typeof g!="number"||!Number.isInteger(g)||g<0)throw new Error(`free dimension override value must be a non-negative integer: ${g}`);let b=Ge(f,n);e._OrtAddFreeDimensionOverride(r,b,g)!==0&&me(`Can't set a free dimension override: ${f} - ${g}.`)}return o.extra!==void 0&&lr(o.extra,"",new WeakSet,(f,g)=>{qt(r,f,g,n)}),[r,n]}catch(i){throw r!==0&&e._OrtReleaseSessionOptions(r)!==0&&me("Can't release session options."),n.forEach(u=>e._free(u)),i}}});var Tt,rt,It,Kt,cr,jr,Zr,mo,X=V(()=>{"use strict";Tt=t=>{switch(t){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${t}`)}},rt=t=>{switch(t){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${t}`)}},It=(t,e)=>{let r=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][t],n=typeof e=="number"?e:e.reduce((o,i)=>o*i,1);return r>0?Math.ceil(n*r):void 0},Kt=t=>{switch(t){case"float16":return typeof Float16Array<"u"?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${t}`)}},cr=t=>{switch(t){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${t}`)}},jr=t=>t==="float32"||t==="float16"||t==="int32"||t==="int64"||t==="uint32"||t==="uint8"||t==="bool"||t==="uint4"||t==="int4",Zr=t=>t==="float32"||t==="float16"||t==="int32"||t==="int64"||t==="uint32"||t==="uint64"||t==="int8"||t==="uint8"||t==="bool"||t==="uint4"||t==="int4",mo=t=>{switch(t){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${t}`)}}});var Mt,Qr=V(()=>{"use strict";Mr();Mt=async t=>{if(typeof t=="string")if(!1)try{let{readFile:e}=to("node:fs/promises");return new Uint8Array(await e(t))}catch(e){if(e.code==="ERR_FS_FILE_TOO_LARGE"){let{createReadStream:r}=to("node:fs"),n=r(t),o=[];for await(let i of n)o.push(i);return new Uint8Array(Buffer.concat(o))}throw e}else{let e=await fetch(t);if(!e.ok)throw new Error(`failed to load external data file: ${t}`);let r=e.headers.get("Content-Length"),n=r?parseInt(r,10):0;if(n<1073741824)return new Uint8Array(await e.arrayBuffer());{if(!e.body)throw new Error(`failed to load external data file: ${t}, no response body.`);let o=e.body.getReader(),i;try{i=new ArrayBuffer(n)}catch(s){if(s instanceof RangeError){let d=Math.ceil(n/65536);i=new WebAssembly.Memory({initial:d,maximum:d}).buffer}else throw s}let u=0;for(;;){let{done:s,value:d}=await o.read();if(s)break;let c=d.byteLength;new Uint8Array(i,u,c).set(d),u+=c}return new Uint8Array(i,0,n)}}else return t instanceof Blob?new Uint8Array(await t.arrayBuffer()):t instanceof Uint8Array?t:new Uint8Array(t)}});var mh,fh,Ws,Gs,Yr,hh,ae,nt=V(()=>{"use strict";X();mh=["V","I","W","E","F"],fh=(t,e)=>{console.log(`[${mh[t]},${new Date().toISOString()}]${e}`)},Yr=(t,e)=>{Ws=t,Gs=e},hh=(t,e)=>{let r=cr(t),n=cr(Ws);r>=n&&fh(r,typeof e=="function"?e():e)},ae=(...t)=>{Gs&&hh(...t)}});var fo,ot,k,Rt,Xr,Hs,Fs,te=V(()=>{"use strict";fo=class{static calcMatMulShape(e,r){return e[1]!==r[0]?void 0:[e[0],r[1]]}},ot=class{static calcShape(e,r,n=!1){let o=e.length,i=r.length;if(o===0)return r;if(i===0)return e;let u=Math.max(e.length,r.length),s=new Array(u);if(n){if(o<2||i<2)return;let d=fo.calcMatMulShape([e[o-2],e[o-1]],[r[i-2],r[i-1]]);if(d===void 0)return;[s[u-2],s[u-1]]=d}for(let d=n?3:1;d<=u;d++){let c=o-d<0?1:e[o-d],p=i-d<0?1:r[i-d];if(c!==p&&c>1&&p>1)return;let f=Math.max(c,p);if(c&&p)s[u-d]=Math.max(c,p);else{if(f>1)return;s[u-d]=0}}return s}static isValidBroadcast(e,r){let n=e.length,o=r.length;if(n>o)return!1;for(let i=1;i<=n;i++)if(e[n-i]!==1&&e[n-i]!==r[o-i])return!1;return!0}},k=class t{static size(e){return t.getSizeFromDimensionRange(e,0,e.length)}static convertShape(e,r=4){let n=e.length;if(n===0)return[];let o=new Array(n),i=n-1;for(;i>=0;){if(e[i]%r===0){o[i]=e[i]/r;break}if(r%e[i]!==0)throw new Error("cannot convert shape");o[i]=1,r/=e[i],i--}for(i--;i>=0;i--)o[i]=e[i];return o}static sizeFromDimension(e,r){if(r<0||r>e.length)throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${e.length} dimensions.`);return t.getSizeFromDimensionRange(e,r,e.length)}static sizeToDimension(e,r){if(r<0||r>e.length)throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${e.length} dimensions.`);return t.getSizeFromDimensionRange(e,0,r)}static getSizeFromDimensionRange(e,r,n){let o=1;for(let i=r;i<n;i++){if(e[i]<0)throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");o*=Number(e[i])}return o}static computeStrides(e){let r=e.length;if(r===0)return[];if(r===1)return[1];let n=new Array(r);n[r-1]=1,n[r-2]=e[r-1];for(let o=r-3;o>=0;--o)n[o]=n[o+1]*e[o+1];return n}static normalizeAxis(e,r){if(e<-r&&e>=r)throw new Error("unsupported axis for this operation.");return e<0?e+r:e}static normalizeAxes(e,r){return e.map(n=>this.normalizeAxis(n,r??e.length))}static sortBasedOnPerm(e,r){return r?r.map(n=>e[n]):e.slice().reverse()}static padShape(e,r){let n=e.length;return e.map((o,i)=>o+r[i]+r[i+n])}static areEqual(e,r){return e.length!==r.length?!1:e.every((n,o)=>n===r[o])}},Rt=class t{static adjustPoolAttributes(e,r,n,o,i,u){if(!e&&n.length!==r.length-2)throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(e)for(let s=0;s<r.length-2;s++)s>=n.length?n.push(r[s+2]):n[s]=r[s+2];for(let s=0;s<n.length;s++)if(s<o.length){if(o[s]<0)throw new Error("strides should be greater than or equal to 1")}else o.push(1);for(let s=0;s<n.length;s++)if(s<i.length){if(i[s]<0)throw new Error("dilations should be greater than or equal to 1")}else i.push(1);for(let s=0;s<n.length*2;s++)if(s<u.length){if(u[s]<0)throw new Error("pad should be greater than or equal to 1")}else u.push(0);for(let s=0;s<n.length;s++){if(n[s]<=0)throw new Error("kernel shapes need to be greater than 0");if(u[s]>=n[s]||u[s+n.length]>=n[s])throw new Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(e,r,n,o,i,u,s){if(s){if(i.length!==2*(e.length-2))throw new Error("length of pads should be twice the length of data dimensions");if(r.length!==e.length-2)throw new Error("length of strides should be the length of data dimensions");if(o.length!==e.length-2)throw new Error("length of kernel shapes should be the length of data dimensions");for(let d=0;d<e.length-2;d++)t.adjustPadAndReturnShape(e[d+(u?1:2)],r[d],n[d],o[d],i,d,d+e.length-2,s)}}static computePoolOutputShape(e,r,n,o,i,u,s,d=0){if(r.length<=0)throw new Error("input shape must be of size greater than 0");let c=[r[0],r[1]];return t.computeShapeHelper(e,r,c,n,o,i,u,s,d),c}static computeConvOutputShape(e,r,n,o,i,u,s){if(e.length<=0||r.length<=0)throw new Error("invalid input tensor dims or invalid filter tensor dims");let d=[e[0],r[0]];return t.computeShapeHelper(!1,e,d,n,o,i,u,s),d}static computeShapeHelper(e,r,n,o,i,u,s,d,c=0){if(e)for(let p=0;p<r.length-2;p++)n.push(1);else for(let p=0;p<r.length-2;p++)n.push(t.adjustPadAndReturnShape(r[p+2],o[p],i[p],u[p],s,p,p+r.length-2,d,c))}static computeOutputSize(e,r,n,o,i){let u=Math.floor(e/r)+1;return i===1&&(u=Math.ceil(e/r)+1,(u-1)*r>=n+o&&(u-=1)),u}static adjustPadAndReturnShape(e,r,n,o,i,u,s,d,c=0){let p=n*(o-1)+1;if(d&&d!=="NOTSET")switch(d){case"VALID":return i[u]=0,i[s]=0,t.computeOutputSize(e-p,r,e,0,c);case"SAME_LOWER":case"SAME_UPPER":if(n!==1)throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let g=(Math.floor((e+r-1)/r)-1)*r+o-e;return i[u]=Math.floor(d==="SAME_LOWER"?(g+1)/2:g/2),i[s]=g-i[u],t.computeOutputSize(e+i[u]+i[s]-p,r,e,i[u],c)}default:throw new Error("Unsupported AutoPad type")}else return t.computeOutputSize(e+i[u]+i[s]-p,r,e,i[u],c)}},Xr=class{static getShapeOfGemmResult(e,r,n,o,i){if(e.length!==2||n.length!==2)throw new Error("shape need to be of size 2");let u,s,d;r?(u=e[1],s=e[0]):(u=e[0],s=e[1]);let c=-1;if(o?(d=n[0],c=1):(d=n[1],c=0),n[c]!==s)throw new Error("dimension mismatch");if(u<=0||d<=0||s<=0)throw new Error("invalid shape specified");if(i&&!ot.isValidBroadcast(i,[u,d]))throw new Error("gemm: invalid bias shape for broadcast");return[u,d,s]}},Hs=-34028234663852886e22,Fs=34028234663852886e22});var Jr,ho=V(()=>{"use strict";X();Jr=(t,e)=>new(Kt(e))(t)});var Ks,gh,js,yh,qs,bh,Zs,en,tn,go,Qs,Ys=V(()=>{"use strict";X();nt();Ks=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),gh=(t,e)=>{if(e==="int32")return t;let r=Ks.get(e);if(!r)throw new Error(`WebNN backend does not support data type: ${e}`);let n=r/8;if(t.byteLength%n!==0)throw new Error(`Invalid Uint8Array length - must be a multiple of ${n}.`);let o=t.byteLength/n,i=new(Kt(e))(t.buffer,t.byteOffset,o);switch(e){case"int64":case"uint64":{let u=new Int32Array(o);for(let s=0;s<o;s++){let d=i[s];if(d>2147483647n||d<-2147483648n)throw new Error("Can not convert int64 data to int32 - value out of range.");u[s]=Number(d)}return new Uint8Array(u.buffer)}case"int8":case"uint8":case"uint32":{if(e==="uint32"&&i.some(s=>s>2147483647))throw new Error("Can not convert uint32 data to int32 - value out of range.");let u=Int32Array.from(i,Number);return new Uint8Array(u.buffer)}default:throw new Error(`Unsupported data conversion from ${e} to 'int32'`)}},js=(t,e)=>{if(e==="int32")return t;if(t.byteLength%4!==0)throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");let r=t.byteLength/4,n=new Int32Array(t.buffer,t.byteOffset,r);switch(e){case"int64":{let o=BigInt64Array.from(n,BigInt);return new Uint8Array(o.buffer)}case"uint64":{if(n.some(i=>i<0))throw new Error("Can not convert int32 data to uin64 - negative value found.");let o=BigUint64Array.from(n,BigInt);return new Uint8Array(o.buffer)}case"int8":{if(n.some(i=>i<-128||i>127))throw new Error("Can not convert int32 data to int8 - value out of range.");let o=Int8Array.from(n,Number);return new Uint8Array(o.buffer)}case"uint8":{if(n.some(o=>o<0||o>255))throw new Error("Can not convert int32 data to uint8 - value out of range.");return Uint8Array.from(n,Number)}case"uint32":{if(n.some(i=>i<0))throw new Error("Can not convert int32 data to uint32 - negative value found.");let o=Uint32Array.from(n,Number);return new Uint8Array(o.buffer)}default:throw new Error(`Unsupported data conversion from 'int32' to ${e}`)}},yh=1,qs=()=>yh++,bh=new Map([["int8","int32"],["uint8","int32"],["uint32","int32"],["int64","int32"]]),Zs=(t,e)=>{let r=Ks.get(t);if(!r)throw new Error(`WebNN backend does not support data type: ${t}`);return e.length>0?Math.ceil(e.reduce((n,o)=>n*o)*r/8):0},en=class{constructor(e){this.isDataConverted=!1;let{sessionId:r,context:n,tensor:o,dataType:i,shape:u,fallbackDataType:s}=e;this.sessionId=r,this.mlContext=n,this.mlTensor=o,this.dataType=i,this.tensorShape=u,this.fallbackDataType=s}get tensor(){return this.mlTensor}get type(){return this.dataType}get fallbackType(){return this.fallbackDataType}get shape(){return this.tensorShape}get byteLength(){return Zs(this.dataType,this.tensorShape)}destroy(){ae("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){if(this.fallbackDataType){let r=await this.mlContext.readTensor(this.mlTensor),n=js(new Uint8Array(r),this.dataType);if(e){(e instanceof ArrayBuffer?new Uint8Array(e):new Uint8Array(e.buffer,e.byteOffset,e.byteLength)).set(n);return}else return new Uint8Array(n).buffer}else return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,r,n){return this.mlContext===e&&this.dataType===r&&this.tensorShape.length===n.length&&this.tensorShape.every((o,i)=>o===n[i])}setIsDataConverted(e){this.isDataConverted=e}},tn=class{constructor(e,r){this.tensorManager=e;this.wrapper=r}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,r,n,o){let i=this.tensorManager.getMLContext(e),u=this.tensorManager.getMLOpSupportLimits(e),s;if(!u?.input.dataTypes.includes(r)){if(s=bh.get(r),!s||!u?.input.dataTypes.includes(s))throw new Error(`WebNN backend does not support data type: ${r}`);ae("verbose",()=>`[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${r} to ${s}`)}if(this.wrapper){if(this.wrapper.canReuseTensor(i,r,n))return this.wrapper.tensor;if(o){if(this.wrapper.byteLength!==Zs(r,n))throw new Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let d=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(e,r,n,d,!0,!0,s),o&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){let r=e;if(this.wrapper){if(this.wrapper.fallbackType)if(this.wrapper.fallbackType==="int32")r=gh(e,this.wrapper.type),this.wrapper.setIsDataConverted(!0);else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(r);return}else ae("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor()}this.activeUpload?this.activeUpload.set(r):this.activeUpload=new Uint8Array(r)}async download(e){if(this.activeUpload){let r=this.wrapper?.isDataConverted?js(this.activeUpload,this.wrapper?.type):this.activeUpload;if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(r):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(r);return}else return r.buffer}if(!this.wrapper)throw new Error("Tensor has not been created.");return e?this.wrapper.read(e):this.wrapper.read()}},go=class{constructor(e){this.backend=e;this.tensorTrackersById=new Map;this.freeTensors=[];this.externalTensors=new Set}getMLContext(e){let r=this.backend.getMLContext(e);if(!r)throw new Error("MLContext not found for session.");return r}getMLOpSupportLimits(e){return this.backend.getMLOpSupportLimits(e)}reserveTensorId(){let e=qs();return this.tensorTrackersById.set(e,new tn(this)),e}releaseTensorId(e){let r=this.tensorTrackersById.get(e);r&&(this.tensorTrackersById.delete(e),r.tensorWrapper&&this.releaseTensor(r.tensorWrapper))}async ensureTensor(e,r,n,o,i){ae("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${r}, dataType: ${n}, shape: ${o}, copyOld: ${i}}`);let u=this.tensorTrackersById.get(r);if(!u)throw new Error("Tensor not found.");return u.ensureTensor(e,n,o,i)}upload(e,r){let n=this.tensorTrackersById.get(e);if(!n)throw new Error("Tensor not found.");n.upload(r)}async download(e,r){ae("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${r?.byteLength}}`);let n=this.tensorTrackersById.get(e);if(!n)throw new Error("Tensor not found.");return n.download(r)}releaseTensorsForSession(e){for(let r of this.freeTensors)r.sessionId===e&&r.destroy();this.freeTensors=this.freeTensors.filter(r=>r.sessionId!==e)}registerTensor(e,r,n,o){let i=this.getMLContext(e),u=qs(),s=new en({sessionId:e,context:i,tensor:r,dataType:n,shape:o});return this.tensorTrackersById.set(u,new tn(this,s)),this.externalTensors.add(s),u}async getCachedTensor(e,r,n,o,i,u,s){let d=this.getMLContext(e);for(let[p,f]of this.freeTensors.entries())if(f.canReuseTensor(d,r,n)){ae("verbose",()=>`[WebNN] Reusing tensor {dataType: ${r}, ${s?`fallbackDataType: ${s},`:""} shape: ${n}`);let g=this.freeTensors.splice(p,1)[0];return g.sessionId=e,g}ae("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${r}, ${s?`fallbackDataType: ${s},`:""} shape: ${n}}`);let c=await d.createTensor({dataType:s??r,shape:n,dimensions:n,usage:o,writable:i,readable:u});return new en({sessionId:e,context:d,tensor:c,dataType:r,shape:n,fallbackDataType:s})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},Qs=(...t)=>new go(...t)});var rn,_h,nn,Xs=V(()=>{"use strict";X();St();ho();Ys();nt();rn=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),_h=(t,e)=>{if(t===e)return!0;if(t===void 0||e===void 0)return!1;let r=Object.keys(t).sort(),n=Object.keys(e).sort();return r.length===n.length&&r.every((o,i)=>o===n[i]&&t[o]===e[o])},nn=class{constructor(e){this.tensorManager=Qs(this);this.mlContextBySessionId=new Map;this.sessionIdsByMLContext=new Map;this.mlContextCache=[];this.sessionGraphInputs=new Map;this.sessionGraphOutputs=new Map;this.temporaryGraphInputs=[];this.temporaryGraphOutputs=[];this.temporarySessionTensorIds=new Map;this.mlOpSupportLimitsBySessionId=new Map;Yr(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw new Error("No active session");return this.activeSessionId}onRunStart(e){ae("verbose",()=>`[WebNN] onRunStart {sessionId: ${e}}`),this.activeSessionId=e}onRunEnd(e){ae("verbose",()=>`[WebNN] onRunEnd {sessionId: ${e}}`);let r=this.temporarySessionTensorIds.get(e);if(r){for(let n of r)ae("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${n}}`),this.tensorManager.releaseTensorId(n);this.temporarySessionTensorIds.delete(e),this.activeSessionId=void 0}}async createMLContext(e){if(e instanceof GPUDevice){let n=this.mlContextCache.findIndex(o=>o.gpuDevice===e);if(n!==-1)return this.mlContextCache[n].mlContext;{let o=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:o}),o}}else if(e===void 0){let n=this.mlContextCache.findIndex(o=>o.options===void 0&&o.gpuDevice===void 0);if(n!==-1)return this.mlContextCache[n].mlContext;{let o=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:o}),o}}let r=this.mlContextCache.findIndex(n=>_h(n.options,e));if(r!==-1)return this.mlContextCache[r].mlContext;{let n=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:n}),n}}registerMLContext(e,r){this.mlContextBySessionId.set(e,r);let n=this.sessionIdsByMLContext.get(r);n||(n=new Set,this.sessionIdsByMLContext.set(r,n)),n.add(e),this.mlOpSupportLimitsBySessionId.has(e)||this.mlOpSupportLimitsBySessionId.set(e,r.opSupportLimits()),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(e,this.temporaryGraphInputs),this.temporaryGraphInputs=[]),this.temporaryGraphOutputs.length>0&&(this.sessionGraphOutputs.set(e,this.temporaryGraphOutputs),this.temporaryGraphOutputs=[])}onReleaseSession(e){this.sessionGraphInputs.delete(e),this.sessionGraphOutputs.delete(e);let r=this.mlContextBySessionId.get(e);if(!r)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e),this.mlOpSupportLimitsBySessionId.delete(e);let n=this.sessionIdsByMLContext.get(r);if(n.delete(e),n.size===0){this.sessionIdsByMLContext.delete(r);let o=this.mlContextCache.findIndex(i=>i.mlContext===r);o!==-1&&this.mlContextCache.splice(o,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}getMLOpSupportLimits(e){return this.mlOpSupportLimitsBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){ae("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,r,n,o,i){let u=rn.get(n);if(!u)throw new Error(`Unsupported ONNX data type: ${n}`);return this.tensorManager.ensureTensor(e??this.currentSessionId,r,u,o,i)}async createTemporaryTensor(e,r,n){ae("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${r}, shape: ${n}}`);let o=rn.get(r);if(!o)throw new Error(`Unsupported ONNX data type: ${r}`);let i=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(e,i,o,n,!1);let u=this.temporarySessionTensorIds.get(e);return u?u.push(i):this.temporarySessionTensorIds.set(e,[i]),i}uploadTensor(e,r){if(!pe().shouldTransferToMLTensor)throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");ae("verbose",()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${r.byteLength}}`),this.tensorManager.upload(e,r)}async downloadTensor(e,r){return this.tensorManager.download(e,r)}createMLTensorDownloader(e,r){return async()=>{let n=await this.tensorManager.download(e);return Jr(n,r)}}registerMLTensor(e,r,n,o){let i=rn.get(n);if(!i)throw new Error(`Unsupported ONNX data type: ${n}`);let u=this.tensorManager.registerTensor(e,r,i,o);return ae("verbose",()=>`[WebNN] registerMLTensor {tensor: ${r}, dataType: ${i}, dimensions: ${o}} -> {tensorId: ${u}}`),u}registerGraphInput(e){this.temporaryGraphInputs.push(e)}registerGraphOutput(e){this.temporaryGraphOutputs.push(e)}isGraphInput(e,r){let n=this.sessionGraphInputs.get(e);return n?n.includes(r):!1}isGraphOutput(e,r){let n=this.sessionGraphOutputs.get(e);return n?n.includes(r):!1}isGraphInputOutputTypeSupported(e,r,n=!0){let o=rn.get(Tt(r)),i=this.mlOpSupportLimitsBySessionId.get(e);return typeof o>"u"?!1:n?!!i?.input.dataTypes.includes(o):!!i?.output.dataTypes.includes(o)}flush(){}}});var on=V(()=>{"use strict"});var Js,yo,bo,wh,vh,eu,wo,_o,ru,nu=V(()=>{"use strict";nt();on();Js=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),yo=[],bo=t=>Math.ceil(Number(t)/16)*16,wh=t=>{for(let e=0;e<yo.length;e++){let r=yo[e];if(t<=r)return r}return Math.ceil(t/16)*16},vh=1,eu=()=>vh++,wo=async(t,e,r,n)=>{let o=bo(r),i=t.device.createBuffer({size:o,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let u=t.getCommandEncoder();t.endComputePass(),u.copyBufferToBuffer(e,0,i,0,o),t.flush(),await i.mapAsync(GPUMapMode.READ);let s=i.getMappedRange();if(n){let d=n();return d.set(new Uint8Array(s,0,r)),d}else return new Uint8Array(s.slice(0,r))}finally{i.destroy()}},_o=class{constructor(e){this.backend=e;this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[r]of Js)yo.push(r),this.freeBuffers.set(r,[]),this.freeUniformBuffers.set(r,[]);this.sessionCount=0}upload(e,r){let n=r.buffer,o=r.byteOffset,i=r.byteLength,u=bo(i),s=this.storageCache.get(e);if(!s)throw new Error("gpu data for uploading does not exist");if(Number(s.originalSize)!==i)throw new Error(`inconsistent data size. gpu data size=${s.originalSize}, data size=${i}`);if(u===i&&o%4===0)this.backend.device.queue.writeBuffer(s.gpuData.buffer,0,n,o,i);else{let d=new Uint8Array(u);d.set(r),this.backend.device.queue.writeBuffer(s.gpuData.buffer,0,d,0,u)}ae("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,r){let n=this.storageCache.get(e);if(!n)throw new Error("source gpu data for memcpy does not exist");let o=this.storageCache.get(r);if(!o)throw new Error("destination gpu data for memcpy does not exist");if(n.originalSize!==o.originalSize)throw new Error("inconsistent source and destination gpu data size");let i=bo(n.originalSize),u=this.backend.getCommandEncoder();this.backend.endComputePass(),u.copyBufferToBuffer(n.gpuData.buffer,0,o.gpuData.buffer,0,i)}registerExternalBuffer(e,r,n){let o;if(n){if(o=n[0],e===n[1])return ae("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${r}) => id=${o}, buffer is the same, skip.`),o;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else o=eu();return this.storageCache.set(o,{gpuData:{id:o,type:0,buffer:e},originalSize:r}),ae("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${r}) => id=${o}, registered.`),o}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),ae("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,r=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let n=wh(e),o,i=(r&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,u=(r&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(i||u){let c=(i?this.freeBuffers:this.freeUniformBuffers).get(n);c?c.length>0?o=c.pop():o=this.backend.device.createBuffer({size:n,usage:r}):o=this.backend.device.createBuffer({size:n,usage:r})}else o=this.backend.device.createBuffer({size:n,usage:r});let s={id:eu(),type:0,buffer:o};return this.storageCache.set(s.id,{gpuData:s,originalSize:Number(e)}),ae("verbose",()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${s.id}`),s}get(e){return this.storageCache.get(e)?.gpuData}release(e){let r=typeof e=="bigint"?Number(e):e,n=this.storageCache.get(r);if(!n){if(this.storageCache.size===0)return 0;throw new Error("releasing data does not exist")}return ae("verbose",()=>`[WebGPU] GpuDataManager.release(id=${r}), gpuDataId=${n.gpuData.id}`),this.storageCache.delete(r),this.buffersPending.push(n.gpuData.buffer),n.originalSize}async download(e,r){let n=this.storageCache.get(Number(e));if(!n)throw new Error("data does not exist");await wo(this.backend,n.gpuData.buffer,n.originalSize,r)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let r=Js.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let n=this.freeBuffers.get(e.size)||[];r===void 0||n.length>=r?e.destroy():n.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let n=this.freeUniformBuffers.get(e.size)||[];r===void 0||n.length>=r?e.destroy():n.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let r of this.buffersPending)e.push(r);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(r=>{r.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(r=>{r.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(r=>{r.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let r=this.capturedPendingBuffers.get(e);r&&(r.forEach(n=>{n.destroy()}),this.capturedPendingBuffers.delete(e)),this.sessionCount-=1,this.sessionCount===0&&(ae("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach(n=>{n.gpuData.buffer.destroy()}),this.storageCache=new Map)}},ru=(...t)=>new _o(...t)});var vo,Q,Ie=V(()=>{"use strict";vo=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(";")),this.key}},Q=t=>new vo(t)});var Ut,xo,$e,Ee,W,_e,So,Nt,Ze,K,an,O,R,ou,sn,$o,iu,oe=V(()=>{"use strict";X();te();Ut=64,xo=(t,e)=>{if(e===3)throw new Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(t)){case 10:return e>1?`vec${e}<f16>`:"f16";case 1:return e>1?`vec${e}<f32>`:"f32";case 6:return e>1?`vec${e}<i32>`:"i32";case 12:return e>1?`vec${e}<u32>`:"u32";case 7:if(e>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(e>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(e!==4)throw new Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw new Error(`Unknown data type: ${t}`)}},$e=(t,e=1)=>{let r=xo(t,e);return typeof r=="string"?r:r[0]},Ee=(t,e=1)=>{let r=xo(t,e);return typeof r=="string"?r:r[1]},W=(...t)=>{let e=[];return t.forEach(r=>{r.length!==0&&e.push({type:12,data:r},{type:12,data:k.computeStrides(r)})}),e},_e=t=>t%4===0?4:t%2===0?2:1,So=(t="f32",e,r="0")=>!e||e===1?`${t}(${r})`:`vec${e}<${t}>(${r})`,Nt=(t,e,r)=>t==="f32"?r:e===1?`f32(${r})`:`vec${e}<f32>(${r})`,Ze=(t,e)=>e===4?`(${t}.x + ${t}.y + ${t}.z + ${t}.w)`:e===2?`(${t}.x + ${t}.y)`:e===3?`(${t}.x + ${t}.y + ${t}.z)`:t,K=(t,e,r,n)=>t.startsWith("uniforms.")&&r>4?typeof e=="string"?n==="f16"?`${t}[(${e}) / 8][(${e}) % 8 / 4][(${e}) % 8 % 4]`:`${t}[(${e}) / 4][(${e}) % 4]`:n==="f16"?`${t}[${Math.floor(e/8)}][${Math.floor(e%8/4)}][${e%8%4}]`:`${t}[${Math.floor(e/4)}][${e%4}]`:r>1?`${t}[${e}]`:t,an=(t,e,r,n,o)=>{let i=typeof r=="number",u=i?r:r.length,s=[...new Array(u).keys()],d=u<2?"u32":u<=4?`vec${u}<u32>`:`array<u32, ${u}>`,c=xo(e,o),p=typeof c=="string"?c:c[1],f=typeof c=="string"?c:c[0],g={indices:d,value:p,storage:f,tensor:e},b=M=>typeof M=="string"?M:`${M}u`,y={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},$=i?"uniforms.":"",T=`${$}${t}_shape`,_=`${$}${t}_strides`,w="";for(let M=0;M<u-1;M++)w+=`
    let dim${M} = current / ${K(_,M,u)};
    let rest${M} = current % ${K(_,M,u)};
    indices[${M}] = dim${M};
    current = rest${M};
    `;w+=`indices[${u-1}] = current;`;let S=u<2?"":`
  fn o2i_${t}(offset: u32) -> ${g.indices} {
    var indices: ${g.indices};
    var current = offset;
    ${w}
    return indices;
  }`,I=M=>(y.offsetToIndices=!0,u<2?M:`o2i_${t}(${M})`),C=[];if(u>=2)for(let M=u-1;M>=0;M--)C.push(`${K(_,M,u)} * (indices[${M}])`);let E=u<2?"":`
  fn i2o_${t}(indices: ${g.indices}) -> u32 {
    return ${C.join("+")};
  }`,B=M=>(y.indicesToOffset=!0,u<2?M:`i2o_${t}(${M})`),x=(...M)=>u===0?"0u":`${g.indices}(${M.map(b).join(",")})`,U=(M,G)=>u<2?`${M}`:`${K(M,G,u)}`,N=(M,G,he)=>u<2?`${M}=${he};`:`${K(M,G,u)}=${he};`,F={},Z=(M,G)=>{y.broadcastedIndicesToOffset=!0;let he=`${G.name}broadcastedIndicesTo${t}Offset`;if(he in F)return`${he}(${M})`;let Ne=[];for(let Ae=u-1;Ae>=0;Ae--){let ke=G.indicesGet("outputIndices",Ae+G.rank-u);Ne.push(`${U(_,Ae)} * (${ke} % ${U(T,Ae)})`)}return F[he]=`fn ${he}(outputIndices: ${G.type.indices}) -> u32 {
             return ${Ne.length>0?Ne.join("+"):"0u"};
           }`,`${he}(${M})`},ee=(M,G)=>(()=>{if(g.storage===g.value)return`${t}[${M}]=${G};`;if(g.storage==="vec2<u32>"&&g.value==="i32")return`${t}[${M}]=vec2<u32>(u32(${G}), select(0u, 0xFFFFFFFFu, ${G} < 0));`;if(g.storage==="vec2<u32>"&&g.value==="u32")return`${t}[${M}]=vec2<u32>(u32(${G}), 0u);`;if(g.storage==="u32"&&g.value==="vec4<bool>")return`${t}[${M}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${G}));`;throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`)})(),D=M=>(()=>{if(g.storage===g.value)return`${t}[${M}]`;if(g.storage==="vec2<u32>"&&g.value==="i32")return`i32(${t}[${M}].x)`;if(g.storage==="vec2<u32>"&&g.value==="u32")return`u32(${t}[${M}].x)`;if(g.storage==="u32"&&g.value==="vec4<bool>")return`vec4<bool>(bool(${t}[${M}] & 0xFFu), bool(${t}[${M}] & 0xFF00u), bool(${t}[${M}] & 0xFF0000u), bool(${t}[${M}] & 0xFF000000u))`;throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`)})(),j=u<2?"":`
  fn get_${t}ByIndices(indices: ${g.indices}) -> ${p} {
    return ${D(`i2o_${t}(indices)`)};
  }`,Y=u<2?"":(()=>{let M=s.map(he=>`d${he}: u32`).join(", "),G=s.map(he=>`d${he}`).join(", ");return`
  fn get_${t}(${M}) -> ${p} {
    return get_${t}ByIndices(${x(G)});
  }`})(),L=(...M)=>{if(M.length!==u)throw new Error(`indices length must be ${u}`);let G=M.map(b).join(",");return u===0?D("0u"):u===1?D(G[0]):(y.get=!0,y.getByIndices=!0,y.indicesToOffset=!0,`get_${t}(${G})`)},J=M=>u<2?D(M):(y.getByIndices=!0,y.indicesToOffset=!0,`get_${t}ByIndices(${M})`),le=u<2?"":`
  fn set_${t}ByIndices(indices: ${g.indices}, value: ${p}) {
    ${ee(`i2o_${t}(indices)`,"value")}
  }`,ne=u<2?"":(()=>{let M=s.map(he=>`d${he}: u32`).join(", "),G=s.map(he=>`d${he}`).join(", ");return`
  fn set_${t}(${M}, value: ${p}) {
    set_${t}ByIndices(${x(G)}, value);
  }`})();return{impl:()=>{let M=[],G=!1;return y.offsetToIndices&&(M.push(S),G=!0),y.indicesToOffset&&(M.push(E),G=!0),y.broadcastedIndicesToOffset&&(Object.values(F).forEach(he=>M.push(he)),G=!0),y.set&&(M.push(ne),G=!0),y.setByIndices&&(M.push(le),G=!0),y.get&&(M.push(Y),G=!0),y.getByIndices&&(M.push(j),G=!0),!i&&G&&M.unshift(`const ${T} = ${g.indices}(${r.join(",")});`,`const ${_} = ${g.indices}(${k.computeStrides(r).join(",")});`),M.join(`
`)},type:g,offsetToIndices:I,indicesToOffset:B,broadcastedIndicesToOffset:Z,indices:x,indicesGet:U,indicesSet:N,set:(...M)=>{if(M.length!==u+1)throw new Error(`indices length must be ${u}`);let G=M[u];if(typeof G!="string")throw new Error("value must be string");let he=M.slice(0,u).map(b).join(",");return u===0?ee("0u",G):u===1?ee(he[0],G):(y.set=!0,y.setByIndices=!0,y.indicesToOffset=!0,`set_${t}(${he}, ${G})`)},setByOffset:ee,setByIndices:(M,G)=>u<2?ee(M,G):(y.setByIndices=!0,y.indicesToOffset=!0,`set_${t}ByIndices(${M}, ${G});`),get:L,getByOffset:D,getByIndices:J,usage:n,name:t,strides:_,shape:T,rank:u}},O=(t,e,r,n=1)=>an(t,e,r,"input",n),R=(t,e,r,n=1)=>an(t,e,r,"output",n),ou=(t,e,r)=>an(t,e,r,"atomicOutput",1),sn=(t,e,r,n=1)=>an(t,e,r,"internal",n),$o=class{constructor(e,r){this.normalizedDispatchGroup=e;this.limits=r;this.internalVariables=[];this.variables=[];this.uniforms=[];this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e=="number"?`${e}u`:e}) { return; }`}mainStart(e=Ut){let r=typeof e=="number"?e:e[0],n=typeof e=="number"?1:e[1],o=typeof e=="number"?1:e[2];if(r>this.limits.maxComputeWorkgroupSizeX||n>this.limits.maxComputeWorkgroupSizeY||o>this.limits.maxComputeWorkgroupSizeZ)throw new Error(`workgroup size [${r}, ${n}, ${o}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(r*n*o>this.limits.maxComputeInvocationsPerWorkgroup)throw new Error(`workgroup size [${r}, ${n}, ${o}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let i=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,u=i?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,s=i?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${r*n*o}u + local_idx;`;return`@compute @workgroup_size(${r}, ${n}, ${o})
  fn main(${u}) {
    ${s}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith("uniforms.")&&this.uniforms.push({name:e.shape.replace("uniforms.",""),type:"u32",length:e.rank}),e.strides.startsWith("uniforms.")&&this.uniforms.push({name:e.strides.replace("uniforms.",""),type:"u32",length:e.rank}))}declareVariable(e,r){if(e.usage==="internal")throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(e),this.appendVariableUniforms(e);let n=e.usage==="input"?"read":"read_write",o=e.usage==="atomicOutput"?"atomic<i32>":e.type.storage;return`@group(0) @binding(${r}) var<storage, ${n}> ${e.name}: array<${o}>;`}declareVariables(...e){return e.map(r=>this.declareVariable(r,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!=="internal")throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(r=>this.registerInternalVariable(r)),this}registerUniform(e,r,n=1){return this.uniforms.push({name:e,type:r,length:n}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let e=[];for(let{name:r,type:n,length:o}of this.uniforms)if(o&&o>4)n==="f16"?e.push(`@align(16) ${r}:array<mat2x4<${n}>, ${Math.ceil(o/8)}>`):e.push(`${r}:array<vec4<${n}>, ${Math.ceil(o/4)}>`);else{let i=o==null||o===1?n:`vec${o}<${n}>`;e.push(`${r}:${i}`)}return`
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=r=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(r)];return this.uniforms.map(r=>[e(r.type),r.length??1])}},iu=(t,e)=>new $o(t,e)});var $h,au,xh,Sh,Th,Ih,ze,su,uu,pt=V(()=>{"use strict";X();te();Ie();oe();$h=(t,e)=>{if(!t||t.length!==1)throw new Error("Transpose requires 1 input.");if(e.length!==0&&e.length!==t[0].dims.length)throw new Error(`perm size ${e.length} does not match input rank ${t[0].dims.length}`)},au=(t,e)=>e.length!==0?e:[...new Array(t).keys()].reverse(),xh=(t,e)=>k.sortBasedOnPerm(t,au(t.length,e)),Sh=(t,e,r,n)=>{let o=`fn perm(i: ${n.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;for(let i=0;i<e;++i)o+=`a[${t[i]}]=i[${i}];`;return o+="return a;}"},Th=(t,e)=>{let r=[],n=[];for(let o=0;o<t.length;++o)t[o]!==1&&r.push(t[o]),t[e[o]]!==1&&n.push(e[o]);return{newShape:r,newPerm:n}},Ih=(t,e)=>{let r=0;for(let n=0;n<t.length;++n)if(e[t[n]]!==1){if(t[n]<r)return!1;r=t[n]}return!0},ze=(t,e)=>{let r=t.dataType,n=t.dims.length,o=au(n,e),i=xh(t.dims,o),u=t.dims,s=i,d=n<2||Ih(o,t.dims),c;if(d)return c=$=>{let T=O("input",r,u,4),_=R("output",r,s,4);return`
  ${$.registerUniform("output_size","u32").declareVariables(T,_)}
  ${$.mainStart()}
    ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let $=k.size(i);return{outputs:[{dims:i,dataType:t.dataType}],dispatchGroup:{x:Math.ceil($/64/4)},programUniforms:[{type:12,data:Math.ceil($/4)}]}},getShaderSource:c};let{newShape:p,newPerm:f}=Th(t.dims,o),g=k.areEqual(f,[2,3,1]),b=k.areEqual(f,[3,1,2]);if(p.length===2||g||b){u=g?[p[0],p[1]*p[2]]:b?[p[0]*p[1],p[2]]:p,s=[u[1],u[0]];let $=16;return c=T=>{let _=O("a",r,u.length),w=R("output",r,s.length);return`
  ${T.registerUniform("output_size","u32").declareVariables(_,w)}
  var<workgroup> tile : array<array<${w.type.value}, ${$+1}>, ${$}>;
  ${T.mainStart([$,$,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${$} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${$}u + local_id.x;
    let input_row = workgroup_id_x * ${$}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${_.getByIndices(`${_.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${$}u + local_id.x;
    let output_row = workgroup_id_y * ${$}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${w.setByIndices(`${w.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let T=k.size(i);return{outputs:[{dims:i,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(s[1]/$),y:Math.ceil(s[0]/$)},programUniforms:[{type:12,data:T},...W(u,s)]}},getShaderSource:c}}return c=$=>{let T=O("a",r,u.length),_=R("output",r,s.length);return`
  ${$.registerUniform("output_size","u32").declareVariables(T,_)}

  ${Sh(o,n,T,_)}

  ${$.mainStart()}
    ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${_.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${_.setByOffset("global_idx",T.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${e}`,inputDependencies:["rank"]},getRunData:()=>{let $=k.size(i);return{outputs:[{dims:i,dataType:t.dataType}],dispatchGroup:{x:Math.ceil($/64)},programUniforms:[{type:12,data:$},...W(u,s)]}},getShaderSource:c}},su=(t,e)=>{$h(t.inputs,e.perm),t.compute(ze(t.inputs[0],e.perm))},uu=t=>Q({perm:t.perm})});var Ah,Ch,Eh,kh,Ph,Oh,Dh,Bh,zh,Mh,it,du,lu,cu,pu,mu,fu,hu,gu,yu,bu,_u=V(()=>{"use strict";X();te();oe();un();pt();Ah={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},Ch={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},Eh={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},kh={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},Ph=(t,e)=>{let r=[];for(let n=e-t;n<e;++n)r.push(n);return r},Oh=(t,e)=>{let r=[],n=t.length;for(let i=0;i<n;i++)e.indexOf(i)===-1&&r.push(t[i]);let o=e.map(i=>t[i]);return[r,o]},Dh=(t,e)=>{let r=t.length+e.length,n=[],o=0;for(let i=0;i<r;i++)e.indexOf(i)===-1?n.push(t[o++]):n.push(1);return n},Bh=(t,e)=>{for(let r=0;r<t.length;++r)if(t[t.length-r-1]!==e-1-r)return!1;return!0},zh=(t,e)=>{let r=[];if(!Bh(t,e)){for(let n=0;n<e;++n)t.indexOf(n)===-1&&r.push(n);t.forEach(n=>r.push(n))}return r},Mh=(t,e,r,n,o,i,u)=>{let s=r[0].dims,d=k.size(i),c=k.size(u),p=O("_A",r[0].dataType,s),f=R("output",o,i),g=64;d===1&&(g=256);let b=`
          var<workgroup> aBestValues : array<f32, ${g}>;
       `,y=$=>`
        ${$.registerUniform("reduceSize","u32").declareVariables(p,f)}
        ${b}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${$.mainStart(g)}

          let outputIndex = global_idx / ${g};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${Eh[n]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${g}) {
           let candidate = f32(${p.getByOffset("offset + k")});
           bestValue = ${Ah[n]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${g}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${Ch[n]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${f.setByOffset("outputIndex",`${n==="mean"?`${f.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${f.type.storage}(${kh[n]})`}`)};
         }
        }`;return{name:t,shaderCache:{hint:`${e};${g}`,inputDependencies:["type"]},getShaderSource:y,getRunData:()=>({outputs:[{dims:i,dataType:o}],dispatchGroup:{x:d},programUniforms:[{type:12,data:c}]})}},it=(t,e,r,n)=>{let o=t.inputs.length===1?r:To(t.inputs,r),i=o.axes;i.length===0&&!o.noopWithEmptyAxes&&(i=t.inputs[0].dims.map((b,y)=>y));let u=k.normalizeAxes(i,t.inputs[0].dims.length),s=u,d=t.inputs[0],c=zh(s,t.inputs[0].dims.length);c.length>0&&(d=t.compute(ze(t.inputs[0],c),{inputs:[0],outputs:[-1]})[0],s=Ph(s.length,d.dims.length));let[p,f]=Oh(d.dims,s),g=p;o.keepDims&&(g=Dh(p,u)),t.compute(Mh(e,o.cacheKey,[d],n,t.inputs[0].dataType,g,f),{inputs:[d]})},du=(t,e)=>{it(t,"ReduceMeanShared",e,"mean")},lu=(t,e)=>{it(t,"ReduceL1Shared",e,"l1")},cu=(t,e)=>{it(t,"ReduceL2Shared",e,"l2")},pu=(t,e)=>{it(t,"ReduceLogSumExpShared",e,"logSumExp")},mu=(t,e)=>{it(t,"ReduceMaxShared",e,"max")},fu=(t,e)=>{it(t,"ReduceMinShared",e,"min")},hu=(t,e)=>{it(t,"ReduceProdShared",e,"prod")},gu=(t,e)=>{it(t,"ReduceSumShared",e,"sum")},yu=(t,e)=>{it(t,"ReduceSumSquareShared",e,"sumSquare")},bu=(t,e)=>{it(t,"ReduceLogSumShared",e,"logSum")}});var at,Rh,dn,To,st,Uh,Nh,Vh,Lh,Wh,Gh,Hh,Fh,qh,Kh,ut,wu,vu,$u,xu,Su,Tu,Iu,Au,Cu,Eu,un=V(()=>{"use strict";X();te();Ie();oe();_u();at=t=>{if(!t||t.length===0||t.length>2)throw new Error("Reduce op requires 1 or 2 inputs.");if(t.length===2&&t[1].dims.length!==1)throw new Error("Invalid axes input dims.")},Rh=t=>["","",`var value = ${t.getByIndices("input_indices")};`,""],dn=(t,e,r,n,o,i,u=!1,s=!1)=>{let d=[],c=r[0].dims,p=c.length,f=k.normalizeAxes(o,p),g=!s&&f.length===0;c.forEach((T,_)=>{g||f.indexOf(_)>=0?u&&d.push(1):d.push(T)});let b=d.length,y=k.size(d);return{name:t,shaderCache:e,getShaderSource:T=>{let _=[],w=O("_A",r[0].dataType,p),S=R("output",i,b),I=n(w,S,f),C=I[2];for(let E=0,B=0;E<p;E++)g||f.indexOf(E)>=0?(u&&B++,C=`for(var j${E}: u32 = 0; j${E} < ${c[E]}; j${E}++) {
                  ${I[2].includes("last_index")?`let last_index = j${E};`:""}
                  ${w.indicesSet("input_indices",E,`j${E}`)}
                  ${C}
                }`):(_.push(`${w.indicesSet("input_indices",E,S.indicesGet("output_indices",B))};`),B++);return`

        ${T.registerUniform("output_size","u32").declareVariables(w,S)}

        ${T.mainStart()}
          ${T.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${w.type.indices};
          let output_indices = ${S.offsetToIndices("global_idx")};

          ${_.join(`
`)}
          ${I[0]}       // init ops for reduce max/min
          ${I[1]}
          ${C}
          ${I[3]}
          ${I.length===4?S.setByOffset("global_idx","value"):I.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:d,dataType:i}],dispatchGroup:{x:Math.ceil(y/64)},programUniforms:[{type:12,data:y},...W(c,d)]})}},To=(t,e)=>{let r=[];return t[1].dims[0]>0&&t[1].getBigInt64Array().forEach(n=>r.push(Number(n))),Q({axes:r,keepDims:e.keepDims,noopWithEmptyAxes:e.noopWithEmptyAxes})},st=(t,e,r,n)=>{let o=t.inputs,i=o.length===1?r:To(o,r);t.compute(dn(e,{hint:i.cacheKey,inputDependencies:["rank"]},[o[0]],i.noopWithEmptyAxes&&i.axes.length===0?Rh:n,i.axes,o[0].dataType,i.keepDims,i.noopWithEmptyAxes),{inputs:[0]})},Uh=(t,e)=>{at(t.inputs),st(t,"ReduceLogSum",e,(n,o)=>[`var value = ${o.type.storage}(0);`,"",`value += ${n.getByIndices("input_indices")};`,"value = log(value);"])},Nh=(t,e)=>{at(t.inputs),st(t,"ReduceL1",e,(n,o)=>[`var value = ${o.type.storage}(0);`,"",`value += abs(${n.getByIndices("input_indices")});`,""])},Vh=(t,e)=>{at(t.inputs),st(t,"ReduceL2",e,(n,o)=>[`var t = ${o.type.value}(0); var value = ${o.type.value}(0);`,"",`t = ${n.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},Lh=(t,e)=>{at(t.inputs),st(t,"ReduceLogSumExp",e,(n,o)=>[`var value = ${o.type.storage}(0);`,"",`value += exp(${n.getByIndices("input_indices")});`,"value = log(value);"])},Wh=(t,e)=>{at(t.inputs),st(t,"ReduceMax",e,(n,o,i)=>{let u=[];for(let s=0;s<n.rank;s++)(i.indexOf(s)>=0||i.length===0)&&u.push(n.indicesSet("input_indices",s,0));return[`${u.join(`
`)}`,`var value = ${n.getByIndices("input_indices")};`,`value = max(value, ${n.getByIndices("input_indices")});`,""]})},Gh=(t,e)=>{at(t.inputs),st(t,"ReduceMean",e,(n,o,i)=>{let u=1;for(let s=0;s<n.rank;s++)(i.indexOf(s)>=0||i.length===0)&&(u*=t.inputs[0].dims[s]);return["var sum = f32(0);","",`sum += f32(${n.getByIndices("input_indices")});`,`let value = ${o.type.value}(sum / ${u});`]})},Hh=(t,e)=>{at(t.inputs),st(t,"ReduceMin",e,(n,o,i)=>{let u=[];for(let s=0;s<n.rank;s++)(i.indexOf(s)>=0||i.length===0)&&u.push(`input_indices[${s}] = 0;`);return[`${u.join(`
`)}`,`var value = ${n.getByIndices("input_indices")};`,`value = min(value, ${n.getByIndices("input_indices")});`,""]})},Fh=(t,e)=>{at(t.inputs),st(t,"ReduceProd",e,(n,o)=>[`var value = ${o.type.storage}(1);`,"",`value *= ${n.getByIndices("input_indices")};`,""])},qh=(t,e)=>{at(t.inputs),st(t,"ReduceSum",e,(n,o)=>[`var value = ${o.type.storage}(0);`,"",`value += ${n.getByIndices("input_indices")};`,""])},Kh=(t,e)=>{at(t.inputs),st(t,"ReduceSumSquare",e,(n,o)=>[`var t = ${o.type.value}(0); var value = ${o.type.value}(0);`,"",`t = ${n.getByIndices("input_indices")}; value += t * t;`,""])},ut=(t,e,r)=>{if(e.length===0)return r;let n=1,o=1;for(let i=0;i<e.length;i++)e.indexOf(i)===-1?n*=t[i]:o*=t[i];return o<32&&n>1024},wu=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Gh(t,e):du(t,e)},vu=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Nh(t,e):lu(t,e)},$u=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Vh(t,e):cu(t,e)},xu=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Lh(t,e):pu(t,e)},Su=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Wh(t,e):mu(t,e)},Tu=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Hh(t,e):fu(t,e)},Iu=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Fh(t,e):hu(t,e)},Au=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?qh(t,e):gu(t,e)},Cu=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Kh(t,e):yu(t,e)},Eu=(t,e)=>{ut(t.inputs[0].dims,e.axes,e.noopWithEmptyAxes)?Uh(t,e):bu(t,e)}});var ku,Pu,Ou,Io,Du=V(()=>{"use strict";X();Ie();un();ku=t=>{if(!t||t.length===0||t.length>2)throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(t[0].dataType!==1)throw new Error("Invalid input type.")},Pu=(t,e)=>{ku(t.inputs);let r=(n,o,i)=>{let u=[];for(let s=0;s<n.rank;s++)(i.indexOf(s)>=0||i.length===0)&&u.push(`input_indices[${s}] = 0;`);return[`${u.join(`
`)}`,`var value = ${n.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${n.getByIndices("input_indices")} ${e.selectLastIndex>0?"<=":"<"} value) {
         value = ${n.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",o.setByOffset("global_idx","best_index")]};t.compute(dn("ArgMin",{hint:e.cacheKey,inputDependencies:["rank"]},[t.inputs[0]],r,[e.axis],7,e.keepDims),{inputs:[0]})},Ou=(t,e)=>{ku(t.inputs);let r=(n,o,i)=>{let u=[];for(let s=0;s<n.rank;s++)(i.indexOf(s)>=0||i.length===0)&&u.push(`input_indices[${s}] = 0;`);return[`${u.join(`
`)}`,`var value = ${n.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${n.getByIndices("input_indices")} ${e.selectLastIndex>0?">=":">"} value) {
         value = ${n.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",o.setByOffset("global_idx","best_index")]};t.compute(dn("argMax",{hint:e.cacheKey,inputDependencies:["rank"]},[t.inputs[0]],r,[e.axis],7,e.keepDims),{inputs:[0]})},Io=t=>Q(t)});var jh,Ao,Zh,Qh,Yh,jt,Xh,Bu,ln=V(()=>{"use strict";X();te();on();oe();jh=(t,e)=>{let r=t[0],n=t[1],o=t[2],i=t[3],u=t[4],s=t[5];if(u&&s)throw new Error("Attention cannot have both past and attention_bias");if(r.dims.length!==3)throw new Error('Input "input" must have 3 dimensions');let d=r.dims[0],c=r.dims[1],p=r.dims[2];if(o.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimensions');if(n.dims.length!==2)throw new Error('Input "weights" is expected to have 2 dimensions');if(n.dims[0]!==p)throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(o.dims[0]!==n.dims[1])throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let f=o.dims[0]/3,g=f,b=g;if(e.qkvHiddenSizes.length>0){if(e.qkvHiddenSizes.length!==3)throw new Error("qkv_hidden_sizes attribute should have 3 elements");for(let S of e.qkvHiddenSizes)if(S%e.numHeads!==0)throw new Error("qkv_hidden_sizes should be divisible by num_heads");f=e.qkvHiddenSizes[0],g=e.qkvHiddenSizes[1],b=e.qkvHiddenSizes[2]}let y=c;if(f!==g)throw new Error("qkv_hidden_sizes first element should be same as the second");if(o.dims[0]!==f+g+b)throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let $=0;if(u){if(g!==b)throw new Error('Input "past" expect k_hidden_size == v_hidden_size');if(u.dims.length!==5)throw new Error('Input "past" must have 5 dimensions');if(u.dims[0]!==2)throw new Error('Input "past" first dimension must be 2');if(u.dims[1]!==d)throw new Error('Input "past" second dimension must be batch_size');if(u.dims[2]!==e.numHeads)throw new Error('Input "past" third dimension must be num_heads');if(u.dims[4]!==g/e.numHeads)throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');e.pastPresentShareBuffer||($=u.dims[3])}let T=y+$,_=-1,w=0;if(i)throw new Error("Mask not supported");if(u)throw new Error("past is not supported");if(s){if(s.dims.length!==4)throw new Error('Input "attention_bias" must have 4 dimensions');if(s.dims[0]!==d||s.dims[1]!==e.numHeads||s.dims[2]!==c||s.dims[3]!==T)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:d,sequenceLength:c,pastSequenceLength:$,kvSequenceLength:y,totalSequenceLength:T,maxSequenceLength:_,inputHiddenSize:p,hiddenSize:f,vHiddenSize:b,headSize:Math.floor(f/e.numHeads),vHeadSize:Math.floor(b/e.numHeads),numHeads:e.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:e.maskFilterValue,maskType:w,scale:e.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},Ao=(t,e,r)=>e&&t?`
      let total_sequence_length_input = u32(${e.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${t?.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${r?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,Zh=(t,e,r,n,o,i,u,s)=>{let d=_e(u?1:i),c=64,p=i/d;p<c&&(c=32);let f=Math.ceil(i/d/c),g=[{type:12,data:e},{type:12,data:r},{type:12,data:n},{type:12,data:o},{type:12,data:p},{type:12,data:f}],b=$e(t.dataType,d),y=Ee(1,d),$=["type"];u&&$.push("type"),s&&$.push("type");let T=_=>{let w=R("x",t.dataType,t.dims,d),S=[w],I=u?O("seq_lens",u.dataType,u.dims):void 0;I&&S.push(I);let C=s?O("total_sequence_length_input",s.dataType,s.dims):void 0;C&&S.push(C);let E=Ee(t.dataType),B=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${c}>;
  var<workgroup> thread_sum: array<f32, ${c}>;
  ${_.registerUniforms(B).declareVariables(...S)}
  ${_.mainStart([c,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${Ao(I,C,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${c}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${u?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${y}(-3.4028234663852886e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${y}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(d){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw new Error(`Unsupported components: ${d}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.4028234663852886e+38f);
    for (var i = 0u; i < ${c}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${y}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${y}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(d){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw new Error(`Unsupported components: ${d}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${c}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${w.type.value}(${E}(1.0) / ${E}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${y}(x[offset + i]);
        x[offset + i] = ${w.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${u?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${w.type.value}(${E}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${c};${b};${d}`,inputDependencies:$},getShaderSource:T,getRunData:()=>({outputs:[],dispatchGroup:{x:1,y:o,z:e*r},programUniforms:g})}},Qh=(t,e,r,n,o,i,u,s,d)=>{let c=u+i.kvSequenceLength,p=[i.batchSize,i.numHeads,i.sequenceLength,c],f=t>1&&n,g=i.kvNumHeads?i.kvNumHeads:i.numHeads,b=f?[i.batchSize,g,c,i.headSize]:void 0,y=i.nReps?i.nReps:1,$=i.scale===0?1/Math.sqrt(i.headSize):i.scale,T=_e(i.headSize),_=i.headSize/T,w=12,S={x:Math.ceil(c/w),y:Math.ceil(i.sequenceLength/w),z:i.batchSize*i.numHeads},I=[{type:12,data:i.sequenceLength},{type:12,data:_},{type:12,data:c},{type:12,data:i.numHeads},{type:12,data:i.headSize},{type:1,data:$},{type:12,data:u},{type:12,data:i.kvSequenceLength},{type:12,data:y}],C=f&&n&&k.size(n.dims)>0,E=["type","type"];C&&E.push("type"),o&&E.push("type"),s&&E.push("type"),d&&E.push("type");let B=[{dims:p,dataType:e.dataType,gpuDataType:0}];f&&B.push({dims:b,dataType:e.dataType,gpuDataType:0});let x=U=>{let N=O("q",e.dataType,e.dims,T),F=O("key",r.dataType,r.dims,T),Z=[N,F];if(C){let le=O("past_key",n.dataType,n.dims,T);Z.push(le)}o&&Z.push(O("attention_bias",o.dataType,o.dims));let ee=s?O("seq_lens",s.dataType,s.dims):void 0;ee&&Z.push(ee);let D=d?O("total_sequence_length_input",d.dataType,d.dims):void 0;D&&Z.push(D);let j=R("output",e.dataType,p),Y=[j];f&&Y.push(R("present_key",e.dataType,b,T));let L=Ee(1,T),J=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${w}u;

  var<workgroup> tileQ: array<${N.type.storage}, ${w*w}>;
  var<workgroup> tileK: array<${N.type.storage}, ${w*w}>;
  ${U.registerUniforms(J).declareVariables(...Z,...Y)}
  ${U.mainStart([w,w,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${y===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${y===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${Ao(ee,D,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${C&&f?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${f?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${L}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${C&&f?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${f?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${L}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(T){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw new Error(`Unsupported components: ${T}`)}})()};
        output[outputIdx] = ${j.type.value} (sum * uniforms.alpha) + ${o?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${T};${o!==void 0};${n!==void 0};${t}`,inputDependencies:E},getRunData:()=>({outputs:B,dispatchGroup:S,programUniforms:I}),getShaderSource:x}},Yh=(t,e,r,n,o,i,u=void 0,s=void 0)=>{let d=i+o.kvSequenceLength,c=o.nReps?o.nReps:1,p=o.vHiddenSize*c,f=t>1&&n,g=o.kvNumHeads?o.kvNumHeads:o.numHeads,b=f?[o.batchSize,g,d,o.headSize]:void 0,y=[o.batchSize,o.sequenceLength,p],$=12,T={x:Math.ceil(o.vHeadSize/$),y:Math.ceil(o.sequenceLength/$),z:o.batchSize*o.numHeads},_=[{type:12,data:o.sequenceLength},{type:12,data:d},{type:12,data:o.vHeadSize},{type:12,data:o.numHeads},{type:12,data:o.headSize},{type:12,data:p},{type:12,data:i},{type:12,data:o.kvSequenceLength},{type:12,data:c}],w=f&&n&&k.size(n.dims)>0,S=["type","type"];w&&S.push("type"),u&&S.push("type"),s&&S.push("type");let I=[{dims:y,dataType:e.dataType,gpuDataType:0}];f&&I.push({dims:b,dataType:e.dataType,gpuDataType:0});let C=E=>{let B=O("probs",e.dataType,e.dims),x=O("v",r.dataType,r.dims),U=[B,x];w&&U.push(O("past_value",n.dataType,n.dims));let N=u?O("seq_lens",u.dataType,u.dims):void 0;u&&U.push(N);let F=s?O("total_sequence_length_input",s.dataType,s.dims):void 0;s&&U.push(F);let ee=[R("output",e.dataType,y)];f&&ee.push(R("present_value",e.dataType,b));let D=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${$}u;
  var<workgroup> tileQ: array<${B.type.value}, ${$*$}>;
  var<workgroup> tileV: array<${B.type.value}, ${$*$}>;
  ${E.registerUniforms(D).declareVariables(...U,...ee)}
  ${E.mainStart([$,$,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${c===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${c===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${Ao(N,F,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${w&&f?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${f?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${B.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${w&&f?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${f?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${n!==void 0};${t}`,inputDependencies:S},getRunData:()=>({outputs:I,dispatchGroup:T,programUniforms:_}),getShaderSource:C}},jt=(t,e,r,n,o,i,u,s,d,c,p=void 0,f=void 0)=>{let g=Math.min(t.outputCount,1+(u?1:0)+(s?1:0)),b=g>1?u:void 0,y=g>1?s:void 0,$=g>1?c.pastSequenceLength:0,T=$+c.kvSequenceLength,_=d&&k.size(d.dims)>0?d:void 0,w=[e,r];b&&k.size(b.dims)>0&&w.push(b),_&&w.push(_),p&&w.push(p),f&&w.push(f);let S=t.compute(Qh(g,e,r,b,_,c,$,p,f),{inputs:w,outputs:g>1?[-1,1]:[-1]})[0];t.compute(Zh(S,c.batchSize,c.numHeads,$,c.sequenceLength,T,p,f),{inputs:p&&f?[S,p,f]:[S],outputs:[]});let I=[S,n];y&&k.size(y.dims)>0&&I.push(y),p&&I.push(p),f&&I.push(f),t.compute(Yh(g,S,n,y,c,$,p,f),{inputs:I,outputs:g>1?[0,2]:[0]})},Xh=(t,e)=>{let r=[e.batchSize,e.numHeads,e.sequenceLength,e.headSize],n=e.sequenceLength,o=e.inputHiddenSize,i=e.headSize,u=12,s={x:Math.ceil(e.headSize/u),y:Math.ceil(e.sequenceLength/u),z:e.batchSize*e.numHeads},d=[t.inputs[0],t.inputs[1],t.inputs[2]],c=[{type:12,data:n},{type:12,data:o},{type:12,data:i},{type:12,data:e.numHeads},{type:12,data:e.headSize},{type:12,data:e.hiddenSize},{type:12,data:e.hiddenSize+e.hiddenSize+e.vHiddenSize}],p=f=>{let g=R("output_q",d[0].dataType,r),b=R("output_k",d[0].dataType,r),y=R("output_v",d[0].dataType,r),$=O("input",d[0].dataType,d[0].dims),T=O("weight",d[1].dataType,d[1].dims),_=O("bias",d[2].dataType,d[2].dims),w=$.type.storage,S=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${u}u;
  var<workgroup> tileInput: array<${w}, ${u*u}>;
  var<workgroup> tileWeightQ: array<${w}, ${u*u}>;
  var<workgroup> tileWeightK: array<${w}, ${u*u}>;
  var<workgroup> tileWeightV: array<${w}, ${u*u}>;
  ${f.registerUniforms(S).declareVariables($,T,_,g,b,y)}
  ${f.mainStart([u,u,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${w}(0);
    var valueK = ${w}(0);
    var valueV = ${w}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return t.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:r,dataType:t.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:t.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:t.inputs[0].dataType,gpuDataType:0}],dispatchGroup:s,programUniforms:c}),getShaderSource:p},{inputs:d,outputs:[-1,-1,-1]})},Bu=(t,e)=>{let r=jh(t.inputs,e),[n,o,i]=Xh(t,r);return jt(t,n,o,i,t.inputs[4],void 0,void 0,void 0,t.inputs[5],r)}});var Jh,eg,tg,zu,Mu=V(()=>{"use strict";Ve();X();te();Ie();oe();Jh=(t,e)=>{if(!t||t.length!==5)throw new Error("BatchNormalization requires 5 inputs");let r=(n,o,i)=>{let u=o.length;if(u!==n.length)throw new Error(`${i}: num dimensions != ${u}`);o.forEach((s,d)=>{if(s!==n[d])throw new Error(`${i}: dim[${d}] do not match`)})};if(t[0].dims.length>1){let n=e.format==="NHWC"?e.spatial?t[0].dims.slice(-1):t[0].dims.slice(-1).concat(t[0].dims.slice(1,t[0].dims.length-1)):t[0].dims.slice(1,e.spatial?2:void 0);r(t[1].dims,n,"Invalid input scale"),r(t[2].dims,n,"Invalid input B"),r(t[3].dims,n,"Invalid input mean"),r(t[4].dims,n,"Invalid input var")}else r(t[1].dims,[1],"Invalid input scale"),r(t[2].dims,[1],"Invalid input B"),r(t[3].dims,[1],"Invalid input mean"),r(t[4].dims,[1],"Invalid input var")},eg=(t,e)=>{let{epsilon:r,spatial:n,format:o}=e,i=t[0].dims,u=n?_e(i[i.length-1]):1,s=o==="NHWC"&&i.length>1?u:1,d=k.size(i)/u,c=n,p=c?i.length:i,f=O("x",t[0].dataType,t[0].dims,u),g=O("scale",t[1].dataType,t[1].dims,s),b=O("bias",t[2].dataType,t[2].dims,s),y=O("inputMean",t[3].dataType,t[3].dims,s),$=O("inputVar",t[4].dataType,t[4].dims,s),T=R("y",t[0].dataType,p,u),_=()=>{let S="";if(n)S=`let cOffset = ${i.length===1?"0u":o==="NHWC"?`outputIndices[${i.length-1}] / ${u}`:"outputIndices[1]"};`;else if(o==="NCHW")S=`
            ${T.indicesSet("outputIndices","0","0")}
            let cOffset = ${T.indicesToOffset("outputIndices")};`;else{S=`var cIndices = ${g.type.indices}(0);
                       cIndices[0] = outputIndices[${i.length-1}];`;for(let I=1;I<g.rank;I++)S+=`cIndices[${I}] = outputIndices[${I}];`;S+=`let cOffset = ${g.indicesToOffset("cIndices")};`}return S},w=S=>`
  const epsilon = ${r};
  ${S.registerUniform("outputSize","u32").declareVariables(f,g,b,y,$,T)}
  ${S.mainStart()}
  ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${T.offsetToIndices(`global_idx * ${u}`)};
    ${_()}
    let scale = ${g.getByOffset("cOffset")};
    let bias = ${b.getByOffset("cOffset")};
    let inputMean = ${y.getByOffset("cOffset")};
    let inputVar = ${$.getByOffset("cOffset")};
    let x = ${f.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${T.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${e.epsilon}_${e.format}_${n}_${u}`,inputDependencies:c?["rank","type","type","type","type"]:void 0},getShaderSource:w,getRunData:()=>({outputs:[{dims:t[0].dims,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:c?[{type:12,data:d},...W(i)]:[{type:12,data:d}]})}},tg=t=>Q(t),zu=(t,e)=>{let{inputs:r,outputCount:n}=t,o=tg({...e,outputCount:n});if(ve.webgpu.validateInputContent&&Jh(r,o),e.trainingMode)throw new Error("BatchNormalization trainingMode is not supported yet.");t.compute(eg(r,o))}});var rg,ng,Ru,Uu=V(()=>{"use strict";te();oe();rg=t=>{if(t[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![320,640,1280].includes(t[0].dims[2]))throw new Error("number of channels should be 320, 640 or 1280");if(t[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(t[0].dims[2]!==t[1].dims[0])throw new Error("last dimension of input and bias are not the same")},ng=t=>{let e=t[0].dims,r=t[0].dims[2],n=k.size(e)/4,o=t[0].dataType,i=O("input",o,e,4),u=O("bias",o,[r],4),s=O("residual",o,e,4),d=R("output",o,e,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:e,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(n/64)}}),getShaderSource:p=>`
  const channels = ${r}u / 4;
  ${p.declareVariables(i,u,s,d)}

  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes(n)}
    let value = ${i.getByOffset("global_idx")}
      + ${u.getByOffset("global_idx % channels")} + ${s.getByOffset("global_idx")};
    ${d.setByOffset("global_idx","value")}
  }`}},Ru=t=>{rg(t.inputs),t.compute(ng(t.inputs))}});var og,we,Nu,Vu,Lu,Wu,Gu,Hu,Fu,qu,Ku,ig,ju,Zu,Qu,Yu,pr,Xu,cn,Ju,ed,td,rd,nd,od,id,ad,sd,ud,dd,ld,cd,pd,md,fd,hd,gd,yd,Co,Eo,bd,_d,wd,ag,sg,vd,pn=V(()=>{"use strict";X();te();Ie();oe();og=(t,e,r,n,o,i,u)=>{let s=Math.ceil(e/4),d="";typeof o=="string"?d=`${o}(a)`:d=o("a");let c=O("inputData",r,[s],4),p=R("outputData",n,[s],4),f=[{name:"vec_size",type:"u32"}];return u&&f.push(...u),`
      ${t.registerUniforms(f).declareVariables(c,p)}

  ${i??""}

  ${t.mainStart()}
    ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${c.getByOffset("global_idx")};
    ${p.setByOffset("global_idx",d)}
  }`},we=(t,e,r,n,o,i=t.dataType,u,s)=>{let d=[{type:12,data:Math.ceil(k.size(t.dims)/4)}];return u&&d.push(...u),{name:e,shaderCache:{hint:o,inputDependencies:["type"]},getShaderSource:c=>og(c,k.size(t.dims),t.dataType,i,r,n,s),getRunData:c=>({outputs:[{dims:t.dims,dataType:i}],dispatchGroup:{x:Math.ceil(k.size(c[0].dims)/64/4)},programUniforms:d})}},Nu=t=>{t.compute(we(t.inputs[0],"Abs","abs"))},Vu=t=>{t.compute(we(t.inputs[0],"Acos","acos"))},Lu=t=>{t.compute(we(t.inputs[0],"Acosh","acosh"))},Wu=t=>{t.compute(we(t.inputs[0],"Asin","asin"))},Gu=t=>{t.compute(we(t.inputs[0],"Asinh","asinh"))},Hu=t=>{t.compute(we(t.inputs[0],"Atan","atan"))},Fu=t=>{t.compute(we(t.inputs[0],"Atanh","atanh"))},qu=t=>Q(t),Ku=(t,e)=>{let r;switch(e.to){case 10:r="vec4<f16>";break;case 1:r="vec4<f32>";break;case 12:r="vec4<u32>";break;case 6:r="vec4<i32>";break;case 9:r="vec4<bool>";break;default:throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${e.to}`)}t.compute(we(t.inputs[0],"Cast",r,void 0,e.cacheKey,e.to))},ig=t=>{let e,r,n=t.length>=2&&t[1].data!==0,o=t.length>=3&&t[2].data!==0;switch(t[0].dataType){case 1:e=n?t[1].getFloat32Array()[0]:-34028234663852886e22,r=o?t[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:e=n?t[1].getUint16Array()[0]:64511,r=o?t[2].getUint16Array()[0]:31743;break;default:throw new Error("Unsupport data type")}return Q({min:e,max:r})},ju=(t,e)=>{let r=e||ig(t.inputs),n=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"Clip",o=>`clamp(${o}, vec4<${n}>(uniforms.min), vec4<${n}>(uniforms.max))`,void 0,r.cacheKey,void 0,[{type:t.inputs[0].dataType,data:r.min},{type:t.inputs[0].dataType,data:r.max}],[{name:"min",type:n},{name:"max",type:n}]),{inputs:[0]})},Zu=t=>{t.compute(we(t.inputs[0],"Ceil","ceil"))},Qu=t=>{t.compute(we(t.inputs[0],"Cos","cos"))},Yu=t=>{t.compute(we(t.inputs[0],"Cosh","cosh"))},pr=t=>Q(t),Xu=(t,e)=>{let r=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"Elu",n=>`elu_vf32(${n})`,`
  const elu_alpha_ = ${r}(${e.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,e.cacheKey))},cn=(t="f32")=>`
const r0: ${t} = 0.3275911;
const r1: ${t} = 0.254829592;
const r2: ${t} = -0.284496736;
const r3: ${t} = 1.421413741;
const r4: ${t} = -1.453152027;
const r5: ${t} = 1.061405429;

fn erf_vf32(v: vec4<${t}>) -> vec4<${t}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,Ju=t=>{let e=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"Erf",r=>`erf_vf32(${r})`,cn(e)))},ed=t=>{t.compute(we(t.inputs[0],"Exp","exp"))},td=t=>{t.compute(we(t.inputs[0],"Floor","floor"))},rd=t=>{let e=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"Gelu",r=>`0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`,cn(e)))},nd=(t,e)=>{let r=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"LeakyRelu",n=>`select(leaky_relu_alpha_ * ${n}, ${n}, ${n} >= vec4<${r}>(0.0))`,`const leaky_relu_alpha_ = ${r}(${e.alpha});`,e.cacheKey))},od=t=>{t.compute(we(t.inputs[0],"Not",e=>`!${e}`))},id=t=>{t.compute(we(t.inputs[0],"Neg",e=>`-${e}`))},ad=t=>{t.compute(we(t.inputs[0],"Reciprocal",e=>`1.0/${e}`))},sd=t=>{let e=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"Relu",r=>`select(vec4<${e}>(0.0), ${r}, ${r} > vec4<${e}>(0.0))`))},ud=t=>{t.compute(we(t.inputs[0],"Sigmoid",e=>`(1.0 / (1.0 + exp(-${e})))`))},dd=t=>Q(t),ld=(t,e)=>{let r=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"HardSigmoid",n=>`max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${e.alpha} * ${n} + vec4<${r}>(${e.beta})))`,void 0,e.cacheKey))},cd=t=>{let e=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"HardSwish",r=>`${r} * max(vec4<${e}>(0.0), min(vec4<${e}>(1.0), vec4<${e}>(${e}(1.0 / 6.0)) * ${r} + vec4<${e}>(0.5)))`))},pd=t=>{t.compute(we(t.inputs[0],"Sin","sin"))},md=t=>{t.compute(we(t.inputs[0],"Sinh","sinh"))},fd=t=>{t.compute(we(t.inputs[0],"Sqrt","sqrt"))},hd=t=>{t.compute(we(t.inputs[0],"Tan","tan"))},gd=t=>`sign(${t}) * (1 - exp(-2 * abs(${t}))) / (1 + exp(-2 * abs(${t})))`,yd=t=>{t.compute(we(t.inputs[0],"Tanh",gd))},Co=(t="f32")=>`
const fast_gelu_a: ${t} = 0.5;
const fast_gelu_b: ${t} = 0.7978845608028654;
const fast_gelu_c: ${t} = 0.035677408136300125;

fn tanh_v(v: vec4<${t}>) -> vec4<${t}> {
  return ${gd("v")};
}
`,Eo=t=>`(fast_gelu_a + fast_gelu_a * tanh_v(${t} * (fast_gelu_c * ${t} * ${t} + fast_gelu_b))) * ${t}`,bd=t=>{let e=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"FastGelu",Eo,Co(e),void 0,t.inputs[0].dataType))},_d=(t,e)=>{let r=Ee(t.inputs[0].dataType);return t.compute(we(t.inputs[0],"ThresholdedRelu",n=>`select(vec4<${r}>(0.0), ${n}, ${n} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${r}>(${e.alpha});`,e.cacheKey)),0},wd=t=>{t.compute(we(t.inputs[0],"Log","log"))},ag=(t,e)=>`
const alpha = vec4<${t}>(${e});
const one = ${t}(1.0);
const zero = ${t}(0.0);

fn quick_gelu_impl(x: vec4<${t}>) -> vec4<${t}> {
  let v = x *alpha;
  var x1 : vec4<${t}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,sg=t=>`quick_gelu_impl(${t})`,vd=(t,e)=>{let r=Ee(t.inputs[0].dataType);t.compute(we(t.inputs[0],"QuickGelu",sg,ag(r,e.alpha),e.cacheKey,t.inputs[0].dataType))}});var ug,dg,xd,Sd=V(()=>{"use strict";te();oe();pn();ug=t=>{if(t[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![2560,5120,10240].includes(t[0].dims[2]))throw new Error("hidden state should be 2560, 5120 or 10240");if(t[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(t[0].dims[2]!==t[1].dims[0])throw new Error("last dimension of input and bias are not the same")},dg=t=>{let e=t[0].dims.slice();e[2]=e[2]/2;let r=O("input",t[0].dataType,t[0].dims,4),n=O("bias",t[0].dataType,[t[0].dims[2]],4),o=R("output",t[0].dataType,e,4),i=k.size(e)/4,u=$e(t[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:e,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)}}),getShaderSource:d=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${t[0].dims[2]/4/2}u;

  ${d.declareVariables(r,n,o)}

  ${cn(u)}

  ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${o.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},xd=t=>{ug(t.inputs),t.compute(dg(t.inputs))}});var lg,cg,dt,Td,Id,Ad,Cd,Ed,kd,Pd,Od,Dd,Bd,zd=V(()=>{"use strict";X();te();oe();lg=(t,e,r,n,o,i,u,s,d,c,p,f)=>{let g,b;typeof s=="string"?g=b=(w,S)=>`${s}((${w}),(${S}))`:typeof s=="function"?g=b=s:(g=s.scalar,b=s.vector);let y=R("outputData",p,n.length,4),$=O("aData",d,e.length,4),T=O("bData",c,r.length,4),_;if(o)if(i){let w=k.size(e)===1,S=k.size(r)===1,I=e.length>0&&e[e.length-1]%4===0,C=r.length>0&&r[r.length-1]%4===0;w||S?_=y.setByOffset("global_idx",b(w?`${$.type.value}(${$.getByOffset("0")}.x)`:$.getByOffset("global_idx"),S?`${T.type.value}(${T.getByOffset("0")}.x)`:T.getByOffset("global_idx"))):_=`
            let outputIndices = ${y.offsetToIndices("global_idx * 4u")};
            let offsetA = ${$.broadcastedIndicesToOffset("outputIndices",y)};
            let offsetB = ${T.broadcastedIndicesToOffset("outputIndices",y)};
            ${y.setByOffset("global_idx",b(u||I?$.getByOffset("offsetA / 4u"):`${$.type.value}(${$.getByOffset("offsetA / 4u")}[offsetA % 4u])`,u||C?T.getByOffset("offsetB / 4u"):`${T.type.value}(${T.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else _=y.setByOffset("global_idx",b($.getByOffset("global_idx"),T.getByOffset("global_idx")));else{if(!i)throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");let w=(S,I,C="")=>{let E=`aData[indexA${I}][componentA${I}]`,B=`bData[indexB${I}][componentB${I}]`;return`
            let outputIndices${I} = ${y.offsetToIndices(`global_idx * 4u + ${I}u`)};
            let offsetA${I} = ${$.broadcastedIndicesToOffset(`outputIndices${I}`,y)};
            let offsetB${I} = ${T.broadcastedIndicesToOffset(`outputIndices${I}`,y)};
            let indexA${I} = offsetA${I} / 4u;
            let indexB${I} = offsetB${I} / 4u;
            let componentA${I} = offsetA${I} % 4u;
            let componentB${I} = offsetB${I} % 4u;
            ${S}[${I}] = ${C}(${g(E,B)});
          `};p===9?_=`
            var data = vec4<u32>(0);
            ${w("data",0,"u32")}
            ${w("data",1,"u32")}
            ${w("data",2,"u32")}
            ${w("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:_=`
            ${w("outputData[global_idx]",0)}
            ${w("outputData[global_idx]",1)}
            ${w("outputData[global_idx]",2)}
            ${w("outputData[global_idx]",3)}
          `}return`
        ${t.registerUniform("vec_size","u32").declareVariables($,T,y)}

        ${f??""}

        ${t.mainStart()}
        ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${_}
      }`},cg=(t,e,r,n,o,i,u=r.dataType)=>{let s=r.dims.map(Number),d=n.dims.map(Number),c=!k.areEqual(s,d),p=s,f=k.size(s),g=!1,b=!1,y=[c];if(c){let $=ot.calcShape(s,d,!1);if(!$)throw new Error("Can't perform binary op on the given tensors");p=$.slice(),f=k.size(p);let T=k.size(s)===1,_=k.size(d)===1,w=s.length>0&&s[s.length-1]%4===0,S=d.length>0&&d[d.length-1]%4===0;y.push(T),y.push(_),y.push(w),y.push(S);let I=1;for(let C=1;C<p.length;C++){let E=s[s.length-C],B=d[d.length-C];if(E===B)I*=E;else break}I%4===0?(b=!0,g=!0):(T||_||w||S)&&(g=!0)}else g=!0;return y.push(g),{name:t,shaderCache:{hint:e+y.map($=>$.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:$=>lg($,s,d,p,g,c,b,o,r.dataType,n.dataType,u,i),getRunData:()=>({outputs:[{dims:p,dataType:u}],dispatchGroup:{x:Math.ceil(f/64/4)},programUniforms:[{type:12,data:Math.ceil(k.size(p)/4)},...W(s,d,p)]})}},dt=(t,e,r,n,o,i)=>{t.compute(cg(e,o??"",t.inputs[0],t.inputs[1],r,n,i))},Td=t=>{dt(t,"Add",(e,r)=>`${e}+${r}`)},Id=t=>{dt(t,"Div",(e,r)=>`${e}/${r}`)},Ad=t=>{dt(t,"Equal",{scalar:(e,r)=>`u32(${e}==${r})`,vector:(e,r)=>`vec4<u32>(${e}==${r})`},void 0,void 0,9)},Cd=t=>{dt(t,"Mul",(e,r)=>`${e}*${r}`)},Ed=t=>{let e=O("input",t.inputs[0].dataType,t.inputs[0].dims).type.value;dt(t,"Pow",{scalar:(n,o)=>`pow_custom(${n},${o})`,vector:(n,o)=>`pow_vector_custom(${n},${o})`},`
    fn pow_custom(a : ${e}, b : ${e}) -> ${e} {
      if (b == ${e}(0.0)) {
        return ${e}(1.0);
      } else if (a < ${e}(0.0) && f32(b) != floor(f32(b))) {
        return ${e}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${e}(1.0), round(f32(abs(b) % ${e}(2.0))) != 1.0) * ${e}(${e==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${e}>, b : vec4<${e}>) -> vec4<${e}> {
      // TODO: implement vectorized pow
      return vec4<${e}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},kd=t=>{dt(t,"Sub",(e,r)=>`${e}-${r}`)},Pd=t=>{dt(t,"Greater",{scalar:(e,r)=>`u32(${e}>${r})`,vector:(e,r)=>`vec4<u32>(${e}>${r})`},void 0,void 0,9)},Od=t=>{dt(t,"Less",{scalar:(e,r)=>`u32(${e}<${r})`,vector:(e,r)=>`vec4<u32>(${e}<${r})`},void 0,void 0,9)},Dd=t=>{dt(t,"GreaterOrEqual",{scalar:(e,r)=>`u32(${e}>=${r})`,vector:(e,r)=>`vec4<u32>(${e}>=${r})`},void 0,void 0,9)},Bd=t=>{dt(t,"LessOrEqual",{scalar:(e,r)=>`u32(${e}<=${r})`,vector:(e,r)=>`vec4<u32>(${e}<=${r})`},void 0,void 0,9)}});var mg,fg,Md,Rd,Ud=V(()=>{"use strict";X();te();Ie();oe();mg=(t,e)=>{if(!t||t.length<1)throw new Error("too few inputs");let r=0,n=t[r],o=n.dataType,i=n.dims.length;t.forEach((u,s)=>{if(s!==r){if(u.dataType!==o)throw new Error("input tensors should be one type");if(u.dims.length!==i)throw new Error("input tensors should have the same shape");u.dims.forEach((d,c)=>{if(c!==e&&d!==n.dims[c])throw new Error("non concat dimensions must match")})}})},fg=(t,e,r,n,o=0)=>{let i=t.reduce((_,w)=>_+k.size(w.dims),0),u=new Array(t.length),s=new Array(t.length),d=new Array(t.length),c=0,p=o,f=[],g=[],b=[{type:12,data:i}];for(let _=0;_<t.length;++_)u[_]=c,s[_]=p,c+=k.size(t[_].dims),p+=t[_].dims[e],g.push(t[_].dims.length),d[_]=O(`input${_}`,n,g[_]),f.push("rank"),b.push({type:12,data:u[_]}),b.push({type:12,data:s[_]});for(let _=0;_<t.length;++_)b.push(...W(t[_].dims));b.push(...W(r));let y=R("output",n,r.length),$=d.map((_,w)=>{let I=`
        let inputOffset = ${`global_idx - uniforms.inputOffset${w}`};
        var outputIndices = ${_.offsetToIndices("inputOffset")};
        ${y.indicesGet("outputIndices",e)} += uniforms.outputAxisOffset${w};
        ${y.setByIndices("outputIndices",_.getByOffset("inputOffset"))}`;return t.length===1?I:w===0?`if (inputIndex == 0u) {${I}}`:w===t.length-1?`else {${I}}`:`else if (inputIndex == ${w}u) {${I}}`}).join(`
`),T=_=>`

  ${(()=>{_.registerUniform("outputSize","u32");for(let w=0;w<t.length;w++)_.registerUniform(`inputOffset${w}`,"u32"),_.registerUniform(`outputAxisOffset${w}`,"u32");return _.declareVariables(...d,y)})()}

  fn calculateInputIndex(global_idx: u32) -> u32 {
    ${d.slice(1).map((w,S)=>`if (global_idx < uniforms.inputOffset${S+1}) {
      return ${S}u;
    }`).join(`
`)}
    return ${t.length-1}u;
  }

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    let inputIndex = calculateInputIndex(global_idx);
    ${$}
  }`;return{name:"Concat",shaderCache:{hint:`${e}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:r,dataType:n}],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:b}),getShaderSource:T}},Md=(t,e)=>{let r=t.inputs,n=r[0].dims,o=k.normalizeAxis(e.axis,n.length);mg(r,o);let i=n.slice();i[o]=r.reduce((c,p)=>c+(p.dims.length>o?p.dims[o]:0),0);let u=r.filter(c=>k.size(c.dims)>0);if(u.length===0){t.output(0,i);return}let s=t.deviceLimits.maxStorageBuffersPerShaderStage-1,d=0;for(let c=0;c<u.length;c+=s){let p=u.slice(c,c+s);t.compute(fg(p,o,i,r[0].dataType,d),{inputs:p,outputs:[0]}),d+=p.reduce((f,g)=>f+g.dims[o],0)}},Rd=t=>Q({axis:t.axis})});var Qe,Ye,Xe,mn,At=V(()=>{"use strict";X();te();Qe=(t,e,r="f32")=>{switch(t.activation){case"Relu":return`value = max(value, ${e}(0.0));`;case"Sigmoid":return`value = (${e}(1.0) / (${e}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${e}(${r}(uniforms.clip_min)), ${e}(${r}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${e}(0.0), min(${e}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${r}(uniforms.alpha) * value, value, value >= ${e}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw new Error(`Unsupported activation ${t.activation}`)}},Ye=(t,e)=>{t.activation==="Clip"?e.push({type:1,data:t.clipMax},{type:1,data:t.clipMin}):t.activation==="HardSigmoid"?e.push({type:1,data:t.alpha},{type:1,data:t.beta}):t.activation==="LeakyRelu"&&e.push({type:1,data:t.alpha})},Xe=(t,e)=>{t.activation==="Clip"?e.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):t.activation==="HardSigmoid"?e.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):t.activation==="LeakyRelu"&&e.push({name:"alpha",type:"f32"})},mn=t=>{let e=t?.activation||"";if(e==="HardSigmoid"){let[r,n]=t?.activation_params||[.2,.5];return{activation:e,alpha:r,beta:n}}else if(e==="Clip"){let[r,n]=t?.activation_params||[Hs,Fs];return{activation:e,clipMax:n,clipMin:r}}else if(e==="LeakyRelu"){let[r]=t?.activation_params||[.01];return{activation:e,alpha:r}}return{activation:e}}});var De,Nd,fn=V(()=>{"use strict";De=(t,e)=>{switch(t){case 1:return e;case 2:return`vec2<${e}>`;case 3:return`vec3<${e}>`;case 4:return`vec4<${e}>`;default:throw new Error(`${t}-component is not supported.`)}},Nd=t=>`
      ${t?"value = value + getBiasByOutputCoords(coords);":""}
      `});var Vd,Ld=V(()=>{"use strict";Vd=t=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${t}.x), i32(${t}.y), i32(${t}.z), 1));
}
`});var mr,hn,gn=V(()=>{"use strict";X();te();oe();At();mr=(t,e,r,n,o)=>{let i=n-r;return`
      ${Array.from({length:r}).map((u,s)=>`
      if (${K(e.shape,s,e.rank)} != 1) {
        ${e.indicesSet(t,s,K(o,s+i,n))}
      } else {
        ${e.indicesSet(t,s,0)}
      }`).join("")}
`},hn=(t,e,r,n,o=!1,i)=>{let u=t[0].dims,s=t[1].dims,d=u[u.length-2],c=s[s.length-1],p=u[u.length-1],f=_e(c),g=_e(p),b=_e(d),y=k.size(r)/f/b,$=t.length>2,T=n?n.slice(0,-2):r.slice(0,-2),w=[k.size(T),d,c],S=[{type:12,data:y},{type:12,data:d},{type:12,data:c},{type:12,data:p}];Ye(e,S),S.push(...W(T,u,s)),$&&S.push(...W(t[2].dims)),S.push(...W(w));let I=C=>{let E=sn("batch_dims",t[0].dataType,T.length),B=O("a",t[0].dataType,u.length,g),x=O("b",t[1].dataType,s.length,f),U=R("output",t[0].dataType,w.length,f),N=$e(U.type.tensor),F=Qe(e,U.type.value,N),Z=[B,x],ee="";if($){let Y=o?f:1;Z.push(O("bias",t[2].dataType,t[2].dims.length,Y)),ee=`${o?`value += bias[col / ${Y}];`:`value += ${U.type.value}(bias[row + i]);`}`}let D=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];Xe(e,D);let j=()=>{let Y=`var a_data: ${B.type.value};`;for(let L=0;L<g;L++)Y+=`
              let b_data${L} = b[(b_offset + (k + ${L}) * uniforms.N + col) / ${f}];`;for(let L=0;L<b;L++){Y+=`a_data = a[(a_offset + (row + ${L}) * uniforms.K + k) / ${g}];`;for(let J=0;J<g;J++)Y+=`
            values[${L}] = fma(${x.type.value}(a_data${g===1?"":`[${J}]`}), b_data${J}, values[${L}]);
`}return Y};return`
  ${C.registerUniforms(D).registerInternalVariables(E).declareVariables(...Z,U)}
  ${C.mainStart()}
    ${C.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${f})) * ${f};
    var index1 = global_idx / (uniforms.N / ${f});
    let stride1 = uniforms.M / ${b};
    let row = (index1 % stride1) * ${b};
    let batch = index1 / stride1;

    ${r.length===2?"":`let batch_indices = ${E.offsetToIndices("batch")};`}

    var a_indices: ${B.type.indices};
    ${mr("a_indices",B,B.rank-2,E.rank,"batch_indices")}
    ${B.indicesSet("a_indices",B.rank-2,0)}
    ${B.indicesSet("a_indices",B.rank-1,0)}
    let a_offset = ${B.indicesToOffset("a_indices")};

    var b_indices: ${x.type.indices};
    ${mr("b_indices",x,x.rank-2,E.rank,"batch_indices")}
    ${x.indicesSet("b_indices",x.rank-2,0)}
    ${x.indicesSet("b_indices",x.rank-1,0)}
    let b_offset = ${x.indicesToOffset("b_indices")};
    var values: array<${U.type.value}, ${b}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${g}) {
      ${j()}
    }
    for (var i = 0u; i < ${b}u; i++) {
      var value = values[i];
      ${ee}
      ${F}
      let cur_indices = ${U.type.indices}(batch, row + i, col);
      let offset = ${U.indicesToOffset("cur_indices")};
      ${U.setByOffset(`offset / ${f}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${e.activation};${f};${g};${b};${o}`,inputDependencies:$?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(y/64)},programUniforms:S}),getShaderSource:I}}});var hg,gg,ko,Wd,yg,Po,bg,fr,yn=V(()=>{"use strict";X();te();oe();At();gn();fn();hg=(t,e)=>t?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${e?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${e?", batchIndices":""});
        `,gg=(t,e)=>t?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${e===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${e===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${e===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,ko=(t,e,r="f32",n,o=!1,i=32,u=!1,s=32)=>{let d=e[1]*t[1],c=e[0]*t[0],p=o?d:i,f=o?i:d,g=p/e[0],b=i/e[1];if(!((o&&g===4&&t[1]===4||!o&&(g===3||g===4))&&p%e[0]===0&&i%e[1]===0&&t[0]===4))throw new Error(`If transposeA ${o} is true, innerElementSize ${g} and workPerThread[1] ${t[1]} must be 4.
      Otherwise, innerElementSize ${g} must be 3 or 4.
  tileAWidth ${p} must be divisible by workgroupSize[0]${e[0]}. tileInner ${i} must be divisible by workgroupSize[1] ${e[1]}. colPerThread ${t[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${g}<${r}>, ${p/g}>, ${f}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${c/t[0]}>, ${i}>;

const rowPerThread = ${t[1]};
const colPerThread = ${t[0]};
const innerElementSize = ${g};
const tileInner = ${i};

@compute @workgroup_size(${e[0]}, ${e[1]}, ${e[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${u?"0":"i32(globalId.z)"};
  ${n?`let batchIndices = ${n.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${d};

  let num_tiles = ${u?`${Math.ceil(s/i)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${u?`i32(globalId.z) * ${s}`:"0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${b};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${hg(o,n)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${b}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${n?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${g===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${gg(o,g)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},Wd=(t,e)=>t?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${e?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${e?", batchIndices":""});
            `,yg=t=>t?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",Po=(t,e,r="f32",n,o=!1,i=32,u=!1,s=32,d=!1)=>{let c=t[1]*e[1],p=t[0]*e[0],f=o?c:i,g=o?i:c;if(!(g%e[1]===0&&f%e[0]===0&&i%e[1]===0))throw new Error(`tileAHight ${g} must be divisible by workgroupSize[1]${e[1]}, tileAWidth ${f} must be divisible by workgroupSize[0]${e[0]}, tileInner ${i} must be divisible by workgroupSize[1]${e[1]}`);let b=g/e[1],y=f/e[0],$=i/e[1],T=d?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${c};
    let globalColStart = i32(workgroupId.x) * ${p};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${g}; inputRow = inputRow + ${e[1]}) {
        for (var inputCol = localCol; inputCol < ${f}; inputCol = inputCol + ${e[0]}) {
          ${Wd(o,n)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${i}; inputRow = inputRow + ${e[1]}) {
            for (var inputCol = localCol; inputCol < ${p}; inputCol = inputCol + ${e[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${n?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${e[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${o?`mm_Asub[k][localRow + innerRow * ${e[1]}];`:`mm_Asub[localRow + innerRow * ${e[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${e[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${e[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${c};

let tileRowA = i32(localId.y) * ${b};
let tileColA = i32(localId.x) * ${y};
let tileRowB = i32(localId.y) * ${$};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${b}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${y}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${Wd(o,n)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${$}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${n?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${yg(o)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${r}, ${f}>, ${g}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${p}>, ${i}>;
  const rowPerThread = ${t[1]};
  const colPerThread = ${t[0]};
  const tileInner = ${i};

@compute @workgroup_size(${e[0]}, ${e[1]}, ${e[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${u?"0":"i32(globalId.z)"};
    ${n?`let batchIndices = ${n.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${u?`${Math.ceil(s/i)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${u?`i32(globalId.z) * ${s}`:"0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${T}
  }
`},bg=(t,e,r,n,o=!1)=>{let[i,u,s,d]=n,c=$e(n[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${i.type.indices}) -> ${De(t,c)} {
      var value = ${De(t,c)}(0.0);
      let col = colIn * ${t};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${u.type.indices};
        ${mr("aIndices",u,u.rank-2,i.rank,"batchIndices")}
        ${u.indicesSet("aIndices",u.rank-2,"u32(row)")}
        ${u.indicesSet("aIndices",u.rank-1,"u32(colIn)")}
        value = ${u.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${i.type.indices}) -> ${De(t,c)} {
      var value = ${De(t,c)}(0.0);
      let col = colIn * ${t};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${s.type.indices};
        ${mr("bIndices",s,s.rank-2,i.rank,"batchIndices")}
        ${s.indicesSet("bIndices",s.rank-2,"u32(row)")}
        ${s.indicesSet("bIndices",s.rank-1,"u32(colIn)")}
        value = ${s.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${De(t,c)}) {
      let col = colIn * ${t};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${e?`value = value + ${o?"bias[colIn]":`${De(t,c)}(bias[row])`};`:""}
        ${r}
        ${d.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},fr=(t,e,r,n,o=!1,i)=>{let u=t[0].dims,s=t[1].dims,d=u.slice(0,-2),c=s.slice(0,-2),p=n?n.slice(0,-2):r.slice(0,-2),f=k.size(p),g=u[u.length-2],b=u[u.length-1],y=s[s.length-1],$=b%4===0&&y%4===0,T=g<=8?[4,1,1]:[4,4,1],_=[8,8,1],w=[Math.ceil(y/_[0]/T[0]),Math.ceil(g/_[1]/T[1]),Math.ceil(f/_[2]/T[2])],S=$?4:1,I=[...d,g,b/S],C=I.length,E=[...c,b,y/S],B=E.length,x=[f,g,y/S],U=[{type:6,data:g},{type:6,data:y},{type:6,data:b}];Ye(e,U),U.push(...W(p,I,E));let N=["rank","rank"],F=t.length>2;F&&(U.push(...W(t[2].dims)),N.push("rank")),U.push(...W(x));let Z=ee=>{let D=p.length,j=sn("batchDims",t[0].dataType,D,1),Y=$e(t[0].dataType),L=O("a",t[0].dataType,C,S),J=O("b",t[1].dataType,B,S),le=R("result",t[0].dataType,x.length,S),ne=[L,J];if(F){let G=o?S:1;ne.push(O("bias",t[2].dataType,t[2].dims.length,G))}let be=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];Xe(e,be);let fe=$e(le.type.tensor),ue=Qe(e,le.type.value,fe),M=bg(S,F,ue,[j,L,J,le],o);return`
  ${ee.registerUniforms(be).registerInternalVariables(j).declareVariables(...ne,le)}
  ${M}
  ${$?ko(T,_,Y,j):Po(T,_,Y,j)}
                   `};return{name:"MatMul",shaderCache:{hint:`${T};${e.activation};${$};${o}`,inputDependencies:N},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:t[0].dataType}],dispatchGroup:{x:w[0],y:w[1],z:w[2]},programUniforms:U}),getShaderSource:Z}}});var _g,Gd,Hd=V(()=>{"use strict";X();nt();oe();At();fn();Ld();yn();_g=(t,e,r,n,o=!1,i,u=4,s=4,d=4,c="f32")=>{let p=N=>{switch(N){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${c}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw new Error(`innerElementSize ${N} is not supported.`)}},f=N=>{switch(N){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw new Error(`innerElementSize ${N} is not supported.`)}},g=t?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,b=t?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,y=t?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",$=t?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",T=t?"row":"col",_=t?"col":"row",w=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${t?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${T} / outWidth;
    let outCol = ${T} % outWidth;

    let WRow = ${_} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${_} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${_} % inChannels;
    var resData = ${De(u,c)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${y} && xCol >= 0 && xCol < ${$}) {
      ${g}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${p(u)}
    }
    return resData;`,S=t?e&&n?`
    let col = colIn * ${u};
    ${w}`:`
    let col = colIn * ${u};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${w}
    }
    return ${De(u,c)}(0.0);`:n&&r?`
    let col = colIn * ${u};
    ${w}`:`
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${w}
    }
    return ${De(u,c)}(0.0);`,I=t?n&&r?f(s):`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${f(s)}
    }
    return ${De(s,c)}(0.0);`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${f(s)}
    }
    return ${De(s,c)}(0.0);`,C=De(d,c),E=t?De(u,c):De(s,c),B=t?De(s,c):De(u,c),x=Qe(i,C,c);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${E} {
      ${t?S:I}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${B} {
      ${t?I:S}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${C}) {
      let col = colIn * ${d};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${t?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${b}
      ${Nd(o)}
      ${x}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},Gd=(t,e,r,n,o,i,u,s,d)=>{let c=e.format==="NHWC",p=c?t[0].dims[3]:t[0].dims[1],f=r[0],g=c?r[2]:r[3],b=c?r[1]:r[2],y=c?r[3]:r[1],$=c&&(p%4===0||p%3===0)&&y%4===0,T=c?y:g*b,_=c?g*b:y,w=[8,8,1],S=n<=8?[4,1,1]:[4,4,1],I=[Math.ceil(T/w[0]/S[0]),Math.ceil(_/w[1]/S[1]),Math.ceil(f/w[2]/S[2])];ae("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${I}`);let C=$?c&&p%4!==0?3:4:1,E=w[1]*S[1],B=w[0]*S[0],x=Math.max(w[0]*C,w[1]),U=n%E===0,N=o%B===0,F=i%x===0,Z=$?[C,4,4]:[1,1,1],ee=[{type:6,data:n},{type:6,data:o},{type:6,data:i},{type:6,data:[e.pads[0],e.pads[1]]},{type:6,data:e.strides},{type:6,data:e.dilations}];Ye(e,ee),ee.push(...W(t[0].dims,t[1].dims));let D=["rank","rank"];u&&(ee.push(...W(t[2].dims)),D.push("rank")),ee.push(...W(r));let j=Y=>{let L=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];Xe(e,L);let J=$?4:1,le=$e(t[0].dataType),ne=`
      fn setOutputAtIndex(flatIndex : i32, value : ${$?`vec4<${le}>`:le}) {
        result[flatIndex] = ${$?`vec4<${le}>`:le}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${$?`vec4<${le}>`:le}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${$?"/ 4":""}, value);
      }`,be=O("x",t[0].dataType,t[0].dims.length,C===3?1:C),fe=O("w",t[1].dataType,t[1].dims.length,J),ue=[be,fe],M=R("result",t[0].dataType,r.length,J);if(u){let G=O("bias",t[2].dataType,t[2].dims.length,J);ue.push(G),ne+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${$?`vec4<${le}>`:le} {
          return bias[coords.${c?"w":"y"}${$?"/ 4":""}];
        }`}return`
        ${Vd("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${Y.registerUniforms(L).declareVariables(...ue,M)}
        ${ne}
        ${_g(c,U,N,F,u,e,Z[0],Z[1],Z[2],le)}
        ${$?ko(S,w,le,void 0,!c,x):Po(S,w,le,void 0,!c,x,!1,void 0,s)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${e.cacheKey};${C};${$};${U};${N};${F};${E};${B};${x}`,inputDependencies:D},getRunData:()=>({outputs:[{dims:d?d(r):r,dataType:t[0].dataType}],dispatchGroup:{x:I[0],y:I[1],z:I[2]},programUniforms:ee}),getShaderSource:j}}});var wg,Fd,bn,vg,qd,$g,Kd,jd,Zd=V(()=>{"use strict";X();nt();te();oe();At();fn();wg=t=>{let e=1;for(let r=0;r<t.length;r++)e*=t[r];return e},Fd=t=>typeof t=="number"?[t,t,t]:t,bn=(t,e)=>e<=1?t:t+(t-1)*(e-1),vg=(t,e,r,n=1)=>{let o=bn(e,n);return Math.floor((t[0]*(r-1)-r+o)/2)},qd=(t,e,r,n,o)=>{o==null&&(o=vg(t,e[0],n[0]));let i=[0,0,0,r];for(let u=0;u<3;u++)t[u]+2*o>=e[u]&&(i[u]=Math.trunc((t[u]-e[u]+2*o)/n[u]+1));return i},$g=(t,e,r,n,o,i,u,s,d,c)=>{let p,f,g,b;if(t==="VALID"&&(t=0),typeof t=="number"){p={top:t,bottom:t,left:t,right:t,front:t,back:t};let y=qd([e,r,n,1],[s,d,c],1,[o,i,u],t);f=y[0],g=y[1],b=y[2]}else if(Array.isArray(t)){if(!t.every(($,T,_)=>$===_[0]))throw Error(`Unsupported padding parameter: ${t}`);p={top:t[0],bottom:t[1],left:t[2],right:t[3],front:t[4],back:t[5]};let y=qd([e,r,n,1],[s,d,c],1,[o,i,u],t[0]);f=y[0],g=y[1],b=y[2]}else if(t==="SAME_UPPER"){f=Math.ceil(e/o),g=Math.ceil(r/i),b=Math.ceil(n/u);let y=(f-1)*o+s-e,$=(g-1)*i+d-r,T=(b-1)*u+c-n,_=Math.floor(y/2),w=y-_,S=Math.floor($/2),I=$-S,C=Math.floor(T/2),E=T-C;p={top:S,bottom:I,left:C,right:E,front:_,back:w}}else throw Error(`Unknown padding parameter: ${t}`);return{padInfo:p,outDepth:f,outHeight:g,outWidth:b}},Kd=(t,e,r,n,o,i=!1,u="channelsLast")=>{let s,d,c,p,f;if(u==="channelsLast")[s,d,c,p,f]=t;else if(u==="channelsFirst")[s,f,d,c,p]=t;else throw new Error(`Unknown dataFormat ${u}`);let[g,,b,y,$]=e,[T,_,w]=Fd(r),[S,I,C]=Fd(n),E=bn(b,S),B=bn(y,I),x=bn($,C),{padInfo:U,outDepth:N,outHeight:F,outWidth:Z}=$g(o,d,c,p,T,_,w,E,B,x),ee=i?g*f:g,D=[0,0,0,0,0];return u==="channelsFirst"?D=[s,ee,N,F,Z]:u==="channelsLast"&&(D=[s,N,F,Z,ee]),{batchSize:s,dataFormat:u,inDepth:d,inHeight:c,inWidth:p,inChannels:f,outDepth:N,outHeight:F,outWidth:Z,outChannels:ee,padInfo:U,strideDepth:T,strideHeight:_,strideWidth:w,filterDepth:b,filterHeight:y,filterWidth:$,effectiveFilterDepth:E,effectiveFilterHeight:B,effectiveFilterWidth:x,dilationDepth:S,dilationHeight:I,dilationWidth:C,inShape:t,outShape:D,filterShape:e}},jd=(t,e,r,n,o,i)=>{let u=i==="channelsLast",s=u?t[0].dims[3]:t[0].dims[1],d=!1,c=[64,1,1],p={x:r.map((w,S)=>S)},f=[Math.ceil(wg(p.x.map(w=>r[w]))/c[0]),1,1];ae("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${f}`);let g=d?u&&s%4!==0?3:4:1,b=k.size(r),y=[{type:12,data:b},{type:12,data:n},{type:12,data:o},{type:12,data:e.strides},{type:12,data:e.dilations}];Ye(e,y),y.push(...W(t[0].dims,t[1].dims));let $=["rank","rank"],T=t.length===3;T&&(y.push(...W(t[2].dims)),$.push("rank")),y.push(...W(r));let _=w=>{let S=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:n.length},{name:"pads",type:"u32",length:o.length},{name:"strides",type:"u32",length:e.strides.length},{name:"dilations",type:"u32",length:e.dilations.length}];Xe(e,S);let I=d?4:1,C=$e(t[0].dataType),E=O("x",t[0].dataType,t[0].dims.length,g===3?1:g),B=O("W",t[1].dataType,t[1].dims.length,I),x=[E,B],U=R("result",t[0].dataType,r.length,I),N="";if(T){let ee=O("bias",t[2].dataType,t[2].dims.length,I);x.push(ee),N+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${d?`vec4<${C}>`:C} {
          return bias[${u?K("coords",4,5):K("coords",1,5)}${d?"/ 4":""}];
        }`}let F=De(g,C),Z=Qe(e,F,C);return`
            ${N}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> ${C} {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${E.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> ${C} {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${B.getByIndices("aIndices")};
            }
          ${w.registerUniforms(S).declareVariables(...x,U)}
          ${w.mainStart()}
          ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${U.offsetToIndices("global_idx")};
              let batch = ${K("coords",0,E.rank)};
              let d2 = ${u?K("coords",E.rank-1,E.rank):K("coords",1,E.rank)};
              let xFRCCorner = vec3<u32>(${u?K("coords",1,E.rank):K("coords",2,E.rank)},
              ${u?K("coords",2,E.rank):K("coords",3,E.rank)},
              ${u?K("coords",3,E.rank):K("coords",4,E.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${u?K("uniforms.x_shape",1,E.rank):K("uniforms.x_shape",2,E.rank)};
              let xShapeZ = ${u?K("uniforms.x_shape",2,E.rank):K("uniforms.x_shape",3,E.rank)};
              let xShapeW = ${u?K("uniforms.x_shape",3,E.rank):K("uniforms.x_shape",4,E.rank)};
              let xShapeU = ${u?K("uniforms.x_shape",4,E.rank):K("uniforms.x_shape",1,E.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = ${C}(0);
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${u?`let xValues = vec4<${C}>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<${C}>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<${C}>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${u?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${u?`let xValues = vec2<${C}>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<${C}>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<${C}>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${u?`let xValues = vec3<${C}>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<${C}>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<${C}>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${T?"value = value + getBiasByOutputCoords(coords)":""};
              ${Z}
              result[global_idx] = ${C}(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${e.cacheKey};${u};${g};${T}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:r,dataType:t[0].dataType}],dispatchGroup:{x:f[0],y:f[1],z:f[2]},programUniforms:y}),getShaderSource:_}}});var Qd,Yd,Xd=V(()=>{"use strict";X();te();oe();At();Qd=(t,e,r,n)=>{let o=t.length>2,i=o?"value += b[output_channel];":"",u=t[0].dims,s=t[1].dims,d=e.format==="NHWC",c=d?r[3]:r[1],p=c/e.group,f=d&&p>=4?_e(c):1,g=k.size(r)/f,b=[{type:12,data:g},{type:12,data:e.dilations},{type:12,data:[e.strides[0],e.strides[1]]},{type:12,data:[e.pads[0],e.pads[1]]},{type:12,data:p}];Ye(e,b),b.push(...W(u,[s[0],s[1],s[2],s[3]/f]));let y=o?["rank","rank","rank"]:["rank","rank"];b.push(...W([r[0],r[1],r[2],r[3]/f]));let $=T=>{let _=R("output",t[0].dataType,r.length,f),w=$e(_.type.tensor),S=Qe(e,_.type.value,w),I=O("x",t[0].dataType,u.length),C=O("w",t[1].dataType,s.length,f),E=[I,C];o&&E.push(O("b",t[2].dataType,t[2].dims,f));let B=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:e.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];Xe(e,B);let x=d?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${I.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${C.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${I.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${C.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${T.registerUniforms(B).declareVariables(...E,_)}

  ${T.mainStart()}
    ${T.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${_.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${d?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${d?1:2}], outputIndices[${d?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${f} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${d?2:1}];

    var value: ${_.type.value} = ${_.type.value}(0);
    ${x}
    ${i}
    ${S}
    ${_.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${e.cacheKey}_${f}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:n?n(r):r,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:b}),getShaderSource:$}},Yd=(t,e,r,n)=>{let o=t.length>2,i=_e(r[3]),u=_e(r[2]),s=k.size(r)/i/u,d=[t[0].dims[0],t[0].dims[1],t[0].dims[2],t[0].dims[3]/i],c=[t[1].dims[0],t[1].dims[1],t[1].dims[2],t[1].dims[3]/i],p=[r[0],r[1],r[2],r[3]/i],f=[{type:12,data:s},{type:6,data:[e.strides[0],e.strides[1]]},{type:6,data:[e.pads[0],e.pads[1]]}];Ye(e,f),f.push(...W(d,c,p));let g=(u-1)*e.strides[1]+c[1],b=y=>{let $=R("output",t[0].dataType,p.length,i),T=$e($.type.tensor),_=Qe(e,$.type.value,T),w=O("x",t[0].dataType,d.length,i),S=O("w",t[1].dataType,c.length,i),I=[w,S];o&&I.push(O("b",t[2].dataType,t[2].dims,i));let C=o?"value += b[output_channel];":"",E=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return Xe(e,E),`
  ${y.registerUniforms(E).declareVariables(...I,$)}
  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${u}u;
    let col = (index1 % width1) * ${u}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${w.type.value}, ${g}>;
    var values: array<${$.type.value}, ${u}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${c[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${g}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${w.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${w.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${c[1]}; w_width++) {
          let w_val = ${S.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${u}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${u}u; i++) {
      var value = values[i];
      ${C}
      ${_}
      ${$.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${e.cacheKey};${i};${u};${g};${c[0]};${c[1]}`,inputDependencies:o?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:n?n(r):r,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:f}),getShaderSource:b}}});var xg,Oo,Sg,Do,Bo,Jd,Tg,Ig,zo,el=V(()=>{"use strict";te();Hd();Zd();yn();Xd();At();gn();pt();xg=(t,e,r,n,o,i)=>{let u=t[0],s=t.slice(i?1:2,i?3:4),d=s.length,c=e[0],f=e.slice(2).map((y,$)=>y+(y-1)*(r[$]-1)),b=s.map((y,$)=>y+n[$]+n[$+d]).map((y,$)=>Math.floor((y-f[$]+o[$])/o[$]));return b.splice(0,0,u),b.splice(i?3:1,0,c),b},Oo=[2,3,1,0],Sg=(t,e)=>{if(!t||t.length!==2&&t.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(t[0].dims.length>5)throw new Error("greater than 5D is not supported");if(t[0].dims.length!==t[1].dims.length)throw new Error("filter does not have same dimension as input");let r=t[0].dims[e.format==="NHWC"?t[0].dims.length-1:1],n=t[1].dims[1]*e.group;if(r!==n)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(t.length===3&&(t[2].dims.length!==1||t[1].dims[0]!==t[2].dims[0]))throw new Error("invalid bias");let o=t[0].dims.length-2;if(e.dilations.length!==o)throw new Error(`dilations should be ${o}D`);if(e.strides.length!==o)throw new Error(`strides should be ${o}D`);if(e.pads.length!==o*2)throw new Error(`pads should be ${o*2}D`);if(e.kernelShape.length!==0&&e.kernelShape.length!==t[1].dims.length-2)throw new Error("invalid kernel shape")},Do=(t,e)=>{let r=t.kernelShape.slice();r.length<e[1].dims.length-2&&r.push(...Array(e[1].dims.length-2-r.length).fill(0));for(let i=2;i<e[1].dims.length;++i)r[i-2]===0&&(r[i-2]=e[1].dims[i]);let n=t.pads.slice();Rt.adjustPadsBasedOnAutoPad(e[0].dims,t.strides,t.dilations,r,n,t.format==="NHWC",t.autoPad);let o=Object.assign({},t);return Object.assign(o,{kernelShape:r,pads:n}),o},Bo=t=>{let e=mn(t),r=t.format,n=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][t.auto_pad],o=t.dilations,i=t.group,u=t.kernel_shape,s=t.pads,d=t.strides,c=t.w_is_const();return{autoPad:n,format:r,dilations:o,group:i,kernelShape:u,pads:s,strides:d,wIsConst:c,...e,cacheKey:`${t.format};${e.activation};`}},Jd=(t,e,r,n)=>{let o=r.format==="NHWC",i=xg(e[0].dims,e[1].dims,r.dilations,r.pads,r.strides,o);if(r.group!==1){let E=[e[0]];if(o){let x=t.kernelCustomData.wT??t.compute(ze(e[1],Oo),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!t.kernelCustomData.wT&&(t.kernelCustomData.wT=x),E.push(x)}else E.push(e[1]);e.length===3&&E.push(e[2]),!t.adapterInfo.isArchitecture("ampere")&&o&&e[1].dims[0]===r.group&&e[1].dims[1]===1&&r.dilations[0]===1&&r.dilations[1]===1?t.compute(Yd(E,r,i,n),{inputs:E}):t.compute(Qd(E,r,i,n),{inputs:E});return}let u=e.length===3,s=e[0].dims[o?1:2],d=e[0].dims[o?2:3],c=e[0].dims[o?3:1],p=e[1].dims[2],f=e[1].dims[3],g=i[o?1:2],b=i[o?2:3],y=i[o?3:1],$=o&&p===s&&f===d&&r.pads[0]===0&&r.pads[1]===0;if($||p===1&&f===1&&r.dilations[0]===1&&r.dilations[1]===1&&r.strides[0]===1&&r.strides[1]===1&&r.pads[0]===0&&r.pads[1]===0){let E=i[0],B,x,U,N=[];if(o){let ee=t.kernelCustomData.wT??t.compute(ze(e[1],Oo),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];if(r.wIsConst&&!t.kernelCustomData.wT&&(t.kernelCustomData.wT=ee),$){let D=s*d*c;B=e[0].reshape([1,E,D]),x=ee.reshape([1,D,y]),U=[1,E,y]}else B=e[0].reshape([E,s*d,c]),x=ee.reshape([1,c,y]),U=[E,g*b,y];N.push(B),N.push(x)}else B=e[0].reshape([E,c,s*d]),x=e[1].reshape([1,y,c]),U=[E,y,g*b],N.push(x),N.push(B);u&&N.push(e[2]);let F=U[2],Z=N[0].dims[N[0].dims.length-1];F<8&&Z<8?t.compute(hn(N,r,i,U,o,n),{inputs:N}):t.compute(fr(N,r,i,U,o,n),{inputs:N});return}let T=!0,_=t.kernelCustomData.wT??t.compute(ze(e[1],Oo),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!t.kernelCustomData.wT&&(t.kernelCustomData.wT=_);let w=[e[0],_];u&&w.push(e[2]);let S=o?g*b:y,I=o?y:g*b,C=p*f*c;t.compute(Gd(w,r,i,S,I,C,u,T,n),{inputs:w})},Tg=(t,e)=>{let r=e.format==="NHWC",n=[t.inputs[0].reshape(r?[t.inputs[0].dims[0],1,t.inputs[0].dims[1],t.inputs[0].dims[2]]:[t.inputs[0].dims[0],t.inputs[0].dims[1],1,t.inputs[0].dims[2]]),t.inputs[1].reshape([t.inputs[1].dims[0],t.inputs[1].dims[1],1,t.inputs[1].dims[2]])];t.inputs.length===3&&n.push(t.inputs[2]);let o=[0,e.pads[0],0,e.pads[1]],i=[1].concat(e.strides),u=[1].concat(e.dilations),s=[1].concat(e.kernelShape),d=Do({...e,pads:o,strides:i,dilations:u,kernelShape:s},n);Jd(t,n,d,c=>r?[c[0],c[2],c[3]]:[c[0],c[1],c[3]])},Ig=(t,e,r)=>{let n=r.format==="NHWC"?"channelsLast":"channelsFirst",o=Do(r,e),i=r.autoPad==="NOTSET"?r.pads:r.autoPad,u=Kd(e[0].dims,e[1].dims,r.strides,r.dilations,i,!1,n);t.compute(jd(e,o,u.outShape,[u.filterDepth,u.filterHeight,u.filterWidth],[u.padInfo.front,u.padInfo.top,u.padInfo.left],n))},zo=(t,e)=>{if(Sg(t.inputs,e),t.inputs[0].dims.length===3)Tg(t,e);else if(t.inputs[0].dims.length===5)Ig(t,t.inputs,e);else{let r=Do(e,t.inputs);Jd(t,t.inputs,r)}}});var tl,rl=V(()=>{"use strict";X();nt();te();oe();tl=(t,e,r)=>{let n=t.length>2,o=e.outputShape,i=e.format==="NHWC",u=e.group,s=t[1].dims,d=s[2]/u,c=s[3],p=i?_e(d):1,f=i&&c===1&&d>=4,g=f?Math.floor(d/4)*4:Math.floor(d/p)*p,b=d-g,y=i?_e(c):1,$=i?c===1?p:y:1,T=k.size(o)/y,_=[Math.ceil(T/64),1,1];ae("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${_}`);let w=["rank","rank"],S=[e.strides[0],e.strides[1]],I=[e.kernelShape[i?1:2],e.kernelShape[i?2:3]],C=[e.dilations[0],e.dilations[1]],E=[I[0]+(e.dilations[0]<=1?0:(e.kernelShape[i?1:2]-1)*(e.dilations[0]-1)),I[1]+(e.dilations[1]<=1?0:(e.kernelShape[i?2:3]-1)*(e.dilations[1]-1))],B=[E[0]-1-Math.floor((e.pads[0]+e.pads[2])/2),E[1]-1-Math.floor((e.pads[1]+e.pads[3])/2)],x=[{type:12,data:T},{type:12,data:S},{type:12,data:I},{type:12,data:C},{type:12,data:E},{type:6,data:B},{type:12,data:g},{type:12,data:d},{type:12,data:c},...W(t[0].dims,t[1].dims)];n&&(x.push(...W(t[2].dims)),w.push("rank")),x.push(...W(o));let U=N=>{let F=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:S.length},{name:"filter_dims",type:"u32",length:I.length},{name:"dilations",type:"u32",length:I.length},{name:"effective_filter_dims",type:"u32",length:E.length},{name:"pads",type:"i32",length:B.length},{name:"input_channels_per_group_int",type:"u32"},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],Z=$e(t[0].dataType),ee=i?1:2,D=i?2:3,j=i?3:1,Y=O("W",t[1].dataType,t[1].dims.length,$),L=O("Dy",t[0].dataType,t[0].dims.length,p),J=[L,Y];n&&J.push(O("bias",t[2].dataType,[o[j]].length,y));let le=R("result",t[0].dataType,o.length,y),ne=()=>{let ue="";if(f)p===4?ue+=`
        let xValue = ${L.getByOffset("x_offset")};
        let wValue = ${Y.getByOffset("w_offset")};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;`:p===2?ue+=`
          dotProd = dotProd + dot(vec4<${Z}>(${L.getByOffset("x_offset")}, ${L.getByOffset("x_offset + 1u")}), vec4<${Z}>(${Y.getByOffset("w_offset")}, ${Y.getByOffset("w_offset + 1u")}));
          x_offset += 2u;
          w_offset += 2u;`:p===1&&(ue+=`
          dotProd = dotProd + dot(vec4<${Z}>(${L.getByOffset("x_offset")}, ${L.getByOffset("x_offset + 1u")}, ${L.getByOffset("x_offset + 2u")}, ${L.getByOffset("x_offset + 3u")}), vec4<${Z}>(${Y.getByOffset("w_offset")}, ${Y.getByOffset("w_offset + 1u")}, ${Y.getByOffset("w_offset + 2u")}, ${Y.getByOffset("w_offset + 3u")}));
          x_offset += 4u;
          w_offset += 4u;`);else if(ue+=`
                  let xValue = ${i?L.getByOffset(`${L.indicesToOffset(`${L.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${p}`):L.get("batch","inputChannel","idyR","idyC")};
        `,p===1)ue+=`
          let w_offset = ${Y.indicesToOffset(`${Y.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${Y.getByOffset(`w_offset / ${$}`)};
          dotProd = dotProd + xValue * wValue;`;else for(let M=0;M<p;M++)ue+=`
            let wValue${M} = ${Y.getByOffset(`${Y.indicesToOffset(`${Y.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${M}, wOutChannel)`)} / ${$}`)};
            dotProd = dotProd + xValue[${M}] * wValue${M};`;return ue},be=()=>{if(b===0)return"";if(!f)throw new Error(`packInputAs4 ${f} is not true.`);let ue="";if(p===1){ue+="dotProd = dotProd";for(let M=0;M<b;M++)ue+=`
            + ${L.getByOffset(`x_offset + ${M}`)} * ${Y.getByOffset(`w_offset + ${M}`)}`;ue+=";"}else if(p===2){if(b!==2)throw new Error(`Invalid inputChannelsRemainder ${b}.`);ue+=`
          let xValue = ${L.getByOffset("x_offset")};
          let wValue = ${Y.getByOffset("w_offset")};
          dotProd = dotProd + dot(xValue, wValue);`}return ue},fe=`
            let outputIndices = ${le.offsetToIndices(`global_idx * ${y}`)};
            let batch = ${le.indicesGet("outputIndices",0)};
            let d1 = ${le.indicesGet("outputIndices",j)};
            let r = ${le.indicesGet("outputIndices",ee)};
            let c = ${le.indicesGet("outputIndices",D)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${le.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${Z}(dyRCorner) + ${Z}(wR)) / ${Z}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${Z}(uniforms.Dy_shape[${ee}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${Z}(dyCCorner) + ${Z}(wC)) / ${Z}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${Z}(uniforms.Dy_shape[${D}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${f?`
                var x_offset = ${L.indicesToOffset(`${L.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${p};
                var w_offset = ${Y.indicesToOffset(`${Y.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${$};
                  `:""}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${f?4:p}) {
                  ${ne()}
                  inputChannel = inputChannel + ${f?4:p};
                }
                ${be()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${n?` + bias[d1 / ${y}]`:""};
            ${le.setByOffset("global_idx","value")};
          `;return`
    ${N.registerUniforms(F).declareVariables(...J,le)}
      ${N.mainStart()}
      ${N.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${fe}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${e.cacheKey};${p}${$}${y}${f}${b}`,inputDependencies:w},getRunData:()=>({dispatchGroup:{x:_[0],y:_[1],z:_[2]},outputs:[{dims:r?r(o):o,dataType:t[0].dataType}],programUniforms:x}),getShaderSource:U}}});var Ag,Cg,Eg,nl,ol,kg,il,Pg,al,sl=V(()=>{"use strict";rl();At();pt();Ag=(t,e,r,n,o,i)=>(t-1)*e+r+(n-1)*o+1-i,Cg=(t,e,r,n,o)=>{let i=Math.floor(t/2);e==="SAME_UPPER"?(r[n]=i,r[o]=t-i):e==="SAME_LOWER"&&(r[n]=t-i,r[o]=i)},Eg=(t,e,r,n,o,i,u,s,d,c)=>{let p=t.length-2,f=c.length===0;d.length<p&&d.push(...Array(p-d.length).fill(0));let g=t[0],b=e[s?3:1]*o;for(let y=0,$=t.length-p-(s?1:0);y<p;++y,++$){let T=t[$],_=f?T*u[y]:c[y],w=Ag(T,u[y],i[y],e[$],r[y],_);Cg(w,n,i,y,y+p),f&&c.push(u[y]*(T-1)+d[y]+(e[$]-1)*r[y]+1-i[y]-i[y+p])}c.splice(0,0,g),c.splice(s?3:1,0,b)},nl=(t,e)=>{let r=t.kernelShape.slice();if(t.kernelShape.length===0||t.kernelShape.reduce((f,g)=>f*g,1)===0){r.length=0;for(let f=2;f<e[1].dims.length;++f)r.push(e[1].dims[f])}let n=t.format==="NHWC";r.splice(0,0,e[1].dims[0]),r.splice(n?3:1,0,e[1].dims[1]);let o=t.pads.slice(),i=t.outputShape.slice(),u=t.outputPadding.slice(),s=e[0].dims,d=t.dilations.slice();if(d.reduce((f,g)=>f+g,0)===0){let f=e[0].dims.length-2;d=new Array(f).fill(1)}let c=t.strides.slice();if(c.reduce((f,g)=>f+g,0)===0){let f=e[0].dims.length-2;c=new Array(f).fill(1)}Eg(s,r,d,t.autoPad,t.group,o,c,n,u,i);let p=Object.assign({},t);return Object.assign(p,{kernelShape:r,pads:o,outputPadding:u,outputShape:i,dilations:d,strides:c}),p},ol=t=>{let e=mn(t),r=t.format,n=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof t.autoPad>"u"?0:t.autoPad],o=t.dilations,i=t.group??1,u=t.kernelShape,s=t.pads,d=t.strides,c=t.wIsConst(),p=t.outputPadding,f=t.outputShape;return{autoPad:n,format:r,dilations:o,group:i,kernelShape:u,outputPadding:p,outputShape:f,pads:s,strides:d,wIsConst:c,...e,cacheKey:`${t.format};${e.activation};`}},kg=(t,e)=>{if(!t||t.length!==2&&t.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(t[0].dims.length!==4&&t[0].dims.length!==3)throw new Error("currently only support 2-dimensional conv");if(t[0].dims.length!==t[1].dims.length)throw new Error("filter does not have same dimension as input");let r=t[0].dims[e.format==="NHWC"?t[0].dims.length-1:1],n=t[1].dims[0];if(r!==n)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let o=t[1].dims[1]*e.group;if(t.length===3&&(t[2].dims.length!==1||t[2].dims[0]!==o))throw new Error("invalid bias");let i=t[0].dims.length-2;if(e.dilations.reduce((p,f)=>p+f,0)>0&&e.dilations.length!==i)throw new Error(`dilations should be ${i}D`);if(e.strides.reduce((p,f)=>p+f,0)>0&&e.strides.length!==i)throw new Error(`strides should be ${i}D`);if(e.pads.reduce((p,f)=>p+f,0)>0&&e.pads.length!==i*2)throw new Error(`pads should be ${i*2}D`);if(e.outputPadding.length!==i&&e.outputPadding.length!==0)throw new Error(`output_padding should be ${i}D`);if(e.kernelShape.reduce((p,f)=>p+f,0)>0&&e.kernelShape.length!==0&&e.kernelShape.length!==t[1].dims.length-2)throw new Error("invalid kernel shape");if(e.outputShape.length!==0&&e.outputShape.length!==t[0].dims.length-2)throw new Error("invalid output shape")},il=(t,e,r,n)=>{let o=t.kernelCustomData.wT??t.compute(ze(e[1],[2,3,0,1]),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!t.kernelCustomData.wT&&(t.kernelCustomData.wT=o);let i=[e[0],o];e.length===3&&i.push(e[2]),t.compute(tl(i,r,n),{inputs:i})},Pg=(t,e)=>{let r=e.format==="NHWC",n=[t.inputs[0].reshape(r?[t.inputs[0].dims[0],1,t.inputs[0].dims[1],t.inputs[0].dims[2]]:[t.inputs[0].dims[0],t.inputs[0].dims[1],1,t.inputs[0].dims[2]]),t.inputs[1].reshape([t.inputs[1].dims[0],t.inputs[1].dims[1],1,t.inputs[1].dims[2]])];t.inputs.length===3&&n.push(t.inputs[2]);let o=e.kernelShape;(o.length===0||o[0]===0)&&(o=[t.inputs[1].dims[2]]);let i=e.dilations;(i.length===0||i[0]===0)&&(i=[1]);let u=e.strides;(u.length===0||u[0]===0)&&(u=[1]);let s=e.pads;s.length===0&&(s=[0,0]),s=[0,s[0],0,s[1]],u=[1].concat(u),i=[1].concat(i),o=[1].concat(o);let d=e.outputPadding;d=[0].concat(d);let c=nl({...e,pads:s,strides:u,dilations:i,kernelShape:o,outputPadding:d},n);il(t,n,c,p=>r?[p[0],p[2],p[3]]:[p[0],p[1],p[3]])},al=(t,e)=>{if(kg(t.inputs,e),t.inputs[0].dims.length===3)Pg(t,e);else{let r=nl(e,t.inputs);il(t,t.inputs,r)}}});var Og,ul,dl,ll=V(()=>{"use strict";X();te();Ie();oe();Og=(t,e,r,n)=>{let o=k.size(e),i=e.length,u=O("input",t,i),s=R("output",t,i),d=r.dataType===6?r.getInt32Array()[0]:Number(r.getBigInt64Array()[0]),c=k.normalizeAxis(d,i),p=f=>{let g=` i32(${u.indicesGet("inputIndices","uniforms.axis")}) `,b=K("uniforms.input_shape","uniforms.axis",i),y=n.reverse?g+(n.exclusive?" + 1":""):"0",$=n.reverse?b:g+(n.exclusive?"":" + 1");return`
                ${f.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(u,s)}
                ${f.mainStart()}
                  ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${s.offsetToIndices("global_idx")};
                  var sum = ${s.type.value}(0);
                  let first : i32 = ${y};
                  let last : i32 = ${$};
                  for (var i : i32 = first; i < last; i++) {
                    ${u.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${u.getByIndices("inputIndices")};
                  }
                  ${s.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:n.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:e,dataType:t}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:[{type:12,data:o},{type:12,data:c},...W(e,e)]}),getShaderSource:p}},ul=(t,e)=>{let r=t.inputs[0].dims,n=t.inputs[0].dataType,o=t.inputs[1];t.compute(Og(n,r,o,e),{inputs:[0]})},dl=t=>{let e=t.exclusive===1,r=t.reverse===1;return Q({exclusive:e,reverse:r})}});var Dg,Bg,zg,cl,pl,ml=V(()=>{"use strict";X();te();Ie();oe();Dg=t=>{if(!t||t.length!==1)throw new Error("DepthToSpace requires 1 input.");if(t[0].dims.length!==4)throw new Error("DepthToSpace requires 4D input.")},Bg=(t,e,r,n)=>{let o=[];o.push(`fn perm(i: ${n.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);for(let i=0;i<e;++i)o.push(r.indicesSet("a",t[i],`i[${i}]`));return o.push("return a;}"),o.join(`
`)},zg=(t,e)=>{let r,n,o,i,u,s,d=e.format==="NHWC",c=e.blocksize,p=e.mode==="DCR";d?([r,n,o,i]=t.dims,u=p?[r,n,o,c,c,i/c**2]:[r,n,o,i/c**2,c,c],s=p?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([r,n,o,i]=[t.dims[0],t.dims[2],t.dims[3],t.dims[1]],u=p?[r,c,c,i/c**2,n,o]:[r,i/c**2,c,c,n,o],s=p?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let f=t.reshape(u),g=f.dims.length,b=t.dataType,y=O("a",b,g),$=R("output",b,g),T=_=>`
  ${_.registerUniform("output_size","u32").declareVariables(y,$)}

  ${Bg(s,g,y,$)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${$.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${$.setByOffset("global_idx",y.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${t.dims};${e.blocksize};${e.mode}`,inputDependencies:["rank"]},getRunData:_=>{let w=d?[r,n*c,o*c,i/c**2]:[r,i/c**2,n*c,o*c],S=k.size(w),I=f.dims,C=k.sortBasedOnPerm(I,s);return{outputs:[{dims:w,dataType:_[0].dataType}],dispatchGroup:{x:Math.ceil(S/64)},programUniforms:[{type:12,data:S},...W(I,C)]}},getShaderSource:T}},cl=(t,e)=>{Dg(t.inputs),t.compute(zg(t.inputs[0],e))},pl=t=>Q({blocksize:t.blocksize,mode:t.mode,format:t.format})});var Ct,_n,Mo,hl,Vt,Mg,Rg,Ug,gl,yl,bl,Ng,Vg,fl,Lg,_l,wl,vl=V(()=>{"use strict";X();te();Ie();oe();Ct=256,_n=512,Mo=2*Math.PI,hl=t=>{let e=[],r=t;for(let n of[4,2,3,5])for(;r%n===0;)e.push(n),r/=n;return r===1?e:void 0},Vt=t=>{let e=t.toPrecision(9);return/[.eE]/.test(e)?e:`${e}.0`},Mg=(t,e,r,n,o)=>{let i=r/t,u=_n-n,s=c=>`smem[${u}u + base + ${c*e}u]`,d=`  for (var t = local_idx; t < ${i}u; t += ${Ct}u) {
`;d+=`    let twiddleIndex = t % ${e}u;
    let angleUnit = f32(twiddleIndex);
`,d+=`    var leg: array<vec2<f32>, 5>;
`;for(let c=0;c<t;c++){let p=`${n}u + t + ${c*i}u`;if(c===0)d+=`    leg[0] = smem[${p}];
`;else{let f=o*Mo*c/(t*e);d+=`    { let a = ${Vt(f)} * angleUnit; leg[${c}] = cmul(smem[${p}], vec2<f32>(cos(a), sin(a))); }
`}}if(d+=`    let base = (t / ${e}u) * ${e*t}u + twiddleIndex;
`,t===2)d+=`    ${s(0)} = leg[0] + leg[1];
    ${s(1)} = leg[0] - leg[1];
`;else if(t===4){let c=o<0?"vec2<f32>(oddDiff.y, -oddDiff.x)":"vec2<f32>(-oddDiff.y, oddDiff.x)";d+=`    let evenSum = leg[0] + leg[2]; let evenDiff = leg[0] - leg[2];
`,d+=`    let oddSum = leg[1] + leg[3]; let oddDiff = leg[1] - leg[3];
`,d+=`    let oddRot = ${c};
`,d+=`    ${s(0)} = evenSum + oddSum;
    ${s(1)} = evenDiff + oddRot;
`,d+=`    ${s(2)} = evenSum - oddSum;
    ${s(3)} = evenDiff - oddRot;
`}else for(let c=0;c<t;c++){let p=["leg[0]"];for(let f=1;f<t;f++){let g=o*Mo*(f*c)/t,b=Vt(Math.cos(g)),y=Vt(Math.sin(g));p.push(`vec2<f32>(leg[${f}].x*${b} - leg[${f}].y*${y}, leg[${f}].x*${y} + leg[${f}].y*${b})`)}d+=`    ${s(c)} = ${p.join(" + ")};
`}return`${d}  }
  workgroupBarrier();
`},Rg=(t,e,r)=>{let n="",o=1,i=0;for(let u of t)n+=Mg(u,o,e,i,r),o*=u,i=_n-i;return{code:n,resultOffset:i}},Ug=(t,e,r,n,o)=>{let i=t.dims,u=i.length,s=i[u-1],d=i[e],c=r&&n?(d-1)*2:d;o!==void 0&&(c=o);let p=r&&n?1:2,f=n&&!r?Math.floor(c/2)+1:c,g=i.slice();g[e]=f,g[u-1]=p;let b=1;for(let $=e+1;$<u-1;$++)b*=i[$];let y=k.size(i)/s/d;return{dataType:t.dataType,outputDims:g,length:c,signalLength:d,inner:b,batch:y,inputComponents:s,outputComponents:p,outputLength:f,inverse:r,onesided:n}},gl=(t,e)=>[e,t.length,t.inputComponents,t.outputComponents,t.inverse,t.onesided].join(";"),yl=t=>[{type:12,data:t.batch},{type:12,data:t.signalLength},{type:12,data:t.inner},{type:12,data:t.outputLength}],bl=(t,e,r)=>t.registerUniform("batch","u32").registerUniform("signalLength","u32").registerUniform("inner","u32").registerUniform("outputLength","u32").declareVariables(e,r),Ng=t=>{let{dataType:e,length:r,inputComponents:n,outputComponents:o,inverse:i,onesided:u}=t,s=Ee(e),d=i?1:-1,c=i?1/r:1,p=hl(r),f=g=>{let b=O("x",e,[1]),y=R("y",e,[1]),$=C=>{let E=`inBase + (${C}) * uniforms.inner * ${n}u`,B=`f32(${b.getByOffset(E)})`,x=n===2?`f32(${b.getByOffset(`${E} + 1u`)})`:"0.0";return`vec2<f32>(${B}, ${x})`},T;if(i&&u){let C=Math.floor(r/2)+1,E=r%2===0?`select(provided, provided - 1u, provided == ${C}u)`:"provided";T=`
    let provided = min(uniforms.signalLength, ${C}u);
    for (var i = local_idx; i < ${r}u; i += ${Ct}u) {
      if (i < provided) { smem[i] = ${$("i")}; } else { smem[i] = vec2<f32>(0.0); }
    }
    workgroupBarrier();
    for (var k = local_idx + 1u; k < ${E}; k += ${Ct}u) {
      let h = smem[k];
      smem[${r}u - k] = vec2<f32>(h.x, -h.y);
    }
    workgroupBarrier();`}else T=`
    let loadCount = min(uniforms.signalLength, ${r}u);
    for (var i = local_idx; i < ${r}u; i += ${Ct}u) {
      if (i < loadCount) { smem[i] = ${$("i")}; } else { smem[i] = vec2<f32>(0.0); }
    }
    workgroupBarrier();`;let{code:_,resultOffset:w}=Rg(p,r,d),S=c===1?`smem[${w}u + i]`:`smem[${w}u + i] * ${Vt(c)}`,I=o===2?y.setByOffset("off + 1u",`${s}(v.y)`):"";return`
  ${bl(g,b,y)}
  var<workgroup> smem: array<vec2<f32>, ${2*_n}>;
  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }
  ${g.mainStart(Ct)}
    let row = workgroup_index;
    if (row >= uniforms.batch) { return; }
    let outer = row / uniforms.inner;
    let within = row % uniforms.inner;
    let inBase = (outer * uniforms.signalLength * uniforms.inner + within) * ${n}u;
    let outBase = (outer * uniforms.outputLength * uniforms.inner + within) * ${o}u;
    ${T}
${_}    for (var i = local_idx; i < uniforms.outputLength; i += ${Ct}u) {
      let v = ${S};
      let off = outBase + i * uniforms.inner * ${o}u;
      ${y.setByOffset("off",`${s}(v.x)`)}
      ${I}
    }
  }`};return{name:"DFT",shaderCache:{hint:gl(t,"fft"),inputDependencies:["type"]},getShaderSource:f,getRunData:()=>({outputs:[{dims:t.outputDims,dataType:e}],programUniforms:yl(t),dispatchGroup:{x:t.batch}})}},Vg=t=>{let{dataType:e,length:r,inputComponents:n,outputComponents:o,inverse:i,onesided:u}=t,s=Ee(e),d=i?1:-1,c=i?1/r:1,p=f=>{let g=O("x",e,[1]),b=R("y",e,[1]),y=S=>{let I=`inBase + (${S}) * uniforms.inner * ${n}u`,C=`f32(${g.getByOffset(I)})`,E=n===2?`f32(${g.getByOffset(`${I} + 1u`)})`:"0.0";return`vec2<f32>(${C}, ${E})`},$=i&&u?`fn spectrum(inBase: u32, k: u32) -> vec2<f32> {
    let provided = min(uniforms.signalLength, ${Math.floor(r/2)+1}u);
    if (k < provided) { return ${y("k")}; }
    let m = ${r}u - k;
    if (m < provided) {
      let h = ${y("m")};
      return vec2<f32>(h.x, -h.y);
    }
    return vec2<f32>(0.0, 0.0);
  }`:`fn spectrum(inBase: u32, n: u32) -> vec2<f32> {
    if (n < uniforms.signalLength) { return ${y("n")}; }
    return vec2<f32>(0.0, 0.0);
  }`,T=`
      let angle = ${Vt(d*Mo)} * f32(knMod) / ${Vt(r)};
      acc += cmul(spectrum(inBase, n), vec2<f32>(cos(angle), sin(angle)));
      knMod += k;
      if (knMod >= ${r}u) { knMod -= ${r}u; }`,_=o===2?b.setByOffset("off + 1u",`${s}(v.y)`):"",w=c===1?"acc":`acc * ${Vt(c)}`;return`
  ${bl(f,g,b)}
  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }
  ${$}
  ${f.mainStart(Ct)}
    let row = workgroup_index;
    if (row >= uniforms.batch) { return; }
    let outer = row / uniforms.inner;
    let within = row % uniforms.inner;
    let inBase = (outer * uniforms.signalLength * uniforms.inner + within) * ${n}u;
    let outBase = (outer * uniforms.outputLength * uniforms.inner + within) * ${o}u;
    for (var k = local_idx; k < uniforms.outputLength; k += ${Ct}u) {
      var acc = vec2<f32>(0.0, 0.0);
      var knMod = 0u;
      for (var n = 0u; n < ${r}u; n++) {${T}
      }
      let v = ${w};
      let off = outBase + k * uniforms.inner * ${o}u;
      ${b.setByOffset("off",`${s}(v.x)`)}
      ${_}
    }
  }`};return{name:"DFT",shaderCache:{hint:gl(t,"direct"),inputDependencies:["type"]},getShaderSource:p,getRunData:()=>({outputs:[{dims:t.outputDims,dataType:e}],programUniforms:yl(t),dispatchGroup:{x:t.batch}})}},fl=t=>{if(!t||t.dataType===0)return;if(k.size(t.dims)!==1)throw new Error("DFT optional scalar inputs must have exactly 1 element.");if(t.dataType===6)return t.getInt32Array()[0];let e=Number(t.getBigInt64Array()[0]);if(!Number.isSafeInteger(e))throw new Error("DFT optional scalar inputs are out of JavaScript safe integer range.");return e},Lg=t=>{if(!t||t.length<1)throw new Error("DFT requires at least 1 input.");let e=t[0].dims;if(e.length<2)throw new Error("DFT input must have at least 2 dimensions.");let r=e[e.length-1];if(r!==1&&r!==2)throw new Error("DFT input's innermost dimension must be 1 (real) or 2 (complex).")},_l=(t,e)=>{Lg(t.inputs);let r=t.inputs[0],n=r.dims.length,o=e.inverse!==0,i=e.onesided!==0,u=fl(t.inputs[1]);if(u!==void 0&&u<=0)throw new Error("dft_length must be greater than zero.");let s=k.normalizeAxis(fl(t.inputs[2])??e.axis,n);if(s===n-1)throw new Error("DFT axis must refer to a signal dimension, not the innermost (real/imaginary) dimension.");if(o&&i&&r.dims[n-1]!==2)throw new Error("Inverse one-sided DFT (IRFFT) requires complex-valued input (innermost dimension 2).");let d=Ug(r,s,o,i,u);if(d.length<=0)throw new Error(`Invalid DFT length: ${d.length}`);let p=d.length<=_n&&hl(d.length)!==void 0?Ng(d):Vg(d);t.compute(p,{inputs:[0]})},wl=t=>Q({axis:t.axis??1,inverse:t.inverse??0,onesided:t.onesided??0})});var Ro,wn,$l,Wg,Gg,Uo,No,xl,Hg,Sl,Tl,Il=V(()=>{"use strict";X();te();Ie();oe();Ro="[a-zA-Z]|\\.\\.\\.",wn="("+Ro+")+",$l="^"+wn+"$",Wg="("+wn+",)*"+wn,Gg="^"+Wg+"$",Uo=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,r){let n=this.symbolToIndices.get(e);n===void 0?n=[r]:n.push(r),this.symbolToIndices.set(e,n)}},No=class{constructor(e,r){this.equation=r;this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=new Array,this.outputDims=[];let[n,o]=r.includes("->")?r.split("->",2):[r,""];if(!n.match(RegExp(Gg)))throw new Error("Invalid LHS term");if(n.split(",").forEach((s,d)=>{let c=e[d].dims.slice();if(!s.match(RegExp($l)))throw new Error("Invalid LHS term");let p=this.processTerm(s,!0,c,d);this.lhs.push(p)}),o==="")o+=[...this.symbolToInfo.entries()].filter(([s,d])=>d.count===1||s==="...").map(([s])=>s).join("");else if(!o.match(RegExp(wn)))throw new Error("Invalid RHS");o.match(RegExp(Ro,"g"))?.forEach(s=>{if(s==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let d=this.symbolToInfo.get(s);if(d===void 0)throw new Error("Invalid RHS symbol");this.outputDims.push(d.dimValue)}}),this.rhs=this.processTerm(o,!1,this.outputDims)}addSymbol(e,r,n){let o=this.symbolToInfo.get(e);if(o!==void 0){if(o.dimValue!==r&&o.count!==1)throw new Error("Dimension mismatch");o.count++,o.inputIndices.push(n)}else o={count:1,dimValue:r,inputIndices:[n]};this.symbolToInfo.set(e,o)}processTerm(e,r,n,o=-1){let i=n.length,u=!1,s=[],d=0;if(!e.match(RegExp($l))&&!r&&e!=="")throw new Error("Invalid LHS term");let c=e.match(RegExp(Ro,"g")),p=new Uo(o);return c?.forEach((f,g)=>{if(f==="..."){if(u)throw new Error("Only one ellipsis is allowed per input term");u=!0;let b=i-c.length+1;if(b<0)throw new Error("Ellipsis out of bounds");if(s=n.slice(d,d+b),this.hasEllipsis){if(this.ellipsisDims.length!==s.length||this.ellipsisDims.toString()!==s.toString())throw new Error("Ellipsis dimensions mismatch")}else if(r)this.hasEllipsis=!0,this.ellipsisDims=s;else throw new Error("Ellipsis must be specified in the LHS");for(let y=0;y<s.length;y++){let $=String.fromCharCode(48+y);p.addSymbol($,g+y),this.addSymbol($,n[d++],o)}}else p.addSymbol(f,g+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(f,n[d++],o)}),p}},xl=t=>t+"_max",Hg=(t,e,r,n)=>{let i=t.map(p=>p.length).map((p,f)=>O(`input${f}`,e,p)),u=k.size(n),s=R("output",e,n.length),d=[...r.symbolToInfo.keys()].filter(p=>!r.rhs.symbolToIndices.has(p)),c=p=>{let f=[],g="var prod = 1.0;",b="var sum = 0.0;",y="sum += prod;",$=[],T=[],_=[],w=[],S=r.symbolToInfo.size===r.rhs.symbolToIndices.size;r.symbolToInfo.forEach((C,E)=>{if(r.rhs.symbolToIndices.has(E)){let B=r.rhs.symbolToIndices.get(E)?.[0];B!==void 0&&r.lhs.forEach((x,U)=>{if(C.inputIndices.includes(U)){let N=x.symbolToIndices.get(E);if(N===void 0)throw new Error("Invalid symbol error");N.forEach(F=>{f.push(`${i[U].indicesSet(`input${U}Indices`,F,s.indicesGet("outputIndices",B))}`)})}})}else r.lhs.forEach((B,x)=>{if(C.inputIndices.includes(x)){let U=B.symbolToIndices.get(E);if(U===void 0)throw new Error("Invalid symbol error");U.forEach(N=>{$.push(`${i[x].indicesSet(`input${x}Indices`,N,`${E}`)}`)}),w.push(`prod *= ${i[x].getByIndices(`input${x}Indices`)};`)}}),T.push(`for(var ${E}: u32 = 0; ${E} < uniforms.${xl(E)}; ${E}++) {`),_.push("}")});let I=S?[...f,`let sum = ${i.map((C,E)=>C.getByIndices(`input${E}Indices`)).join(" * ")};`]:[...f,b,...T,...$,g,...w,y,..._];return`
            ${p.registerUniforms(d.map(C=>({name:`${xl(C)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...i,s)}

            ${p.mainStart()}
            ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${s.offsetToIndices("global_idx")};
            ${i.map((C,E)=>`var input${E}Indices: ${i[E].type.indices};`).join(`
`)}
            ${I.join(`
`)};
            ${s.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:r.equation,inputDependencies:t.map(()=>"rank")},getRunData:()=>{let p=d.filter(g=>r.symbolToInfo.has(g)).map(g=>({type:12,data:r.symbolToInfo.get(g)?.dimValue||0}));p.push({type:12,data:u});let f=t.map((g,b)=>[...W(g)]).reduce((g,b)=>g.concat(b),p);return f.push(...W(n)),{outputs:[{dims:n,dataType:e}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:f}},getShaderSource:c}},Sl=(t,e)=>{let r=new No(t.inputs,e.equation),n=r.outputDims,o=t.inputs.map((i,u)=>i.dims);t.compute(Hg(o,t.inputs[0].dataType,r,n))},Tl=t=>{let e=t.equation.replace(/\s+/g,"");return Q({equation:e})}});var Fg,Al,qg,Kg,Cl,El=V(()=>{"use strict";X();te();oe();Fg=t=>{if(!t||t.length!==2)throw new Error("Expand requires 2 input.");let e=t[0].dims,r=Array.from(t[1].getBigInt64Array(),Number),n=r.length<e.length?0:r.length-e.length,o=e.length<r.length?0:e.length-r.length;for(;n<r.length&&o<e.length;++n,++o)if(r[n]!==e[o]&&r[n]!==1&&e[o]!==1)throw new Error("Expand requires shape to be broadcastable to input")},Al=(t,e)=>{let r=t.length-e.length,n=[];for(let o=0;o<r;++o)n.push(t[o]);for(let o=0;o<e.length;++o)n.push(e[o]===1?t[o+r]:e[o]);return n},qg=(t,e)=>t.length>e.length?Al(t,e):Al(e,t),Kg=t=>{let e=t[0].dims,r=Array.from(t[1].getBigInt64Array(),Number),n=qg(e,r),o=t[0].dataType,i=o===9||k.size(e)===1,u=o===9||e.length>0&&e[e.length-1]%4===0?4:1,s=i||n.length>0&&n[n.length-1]%4===0?4:1,d=Math.ceil(k.size(n)/s),c=f=>{let g=O("input",o,e.length,u),b=R("output",o,n.length,s),y;if(o===9){let $=(T,_,w="")=>`
          let outputIndices${_} = ${b.offsetToIndices(`outputOffset + ${_}u`)};
          let offset${_} = ${g.broadcastedIndicesToOffset(`outputIndices${_}`,b)};
          let index${_} = offset${_} / 4u;
          let component${_} = offset${_} % 4u;
          ${T}[${_}] = ${w}(${g.getByOffset(`index${_}`)}[component${_}]);
        `;y=`
        let outputOffset = global_idx * ${s};
        var data = vec4<u32>(0);
        ${$("data",0,"u32")}
        ${$("data",1,"u32")}
        ${$("data",2,"u32")}
        ${$("data",3,"u32")}
        ${b.setByOffset("global_idx","data")}
      }`}else y=`
        let outputIndices = ${b.offsetToIndices(`global_idx * ${s}`)};
        let inputOffset = ${g.broadcastedIndicesToOffset("outputIndices",b)};
        let data = ${b.type.value}(${g.getByOffset(`inputOffset / ${u}`)});
        ${b.setByOffset("global_idx","data")}
      }`;return`
    ${f.registerUniform("vec_size","u32").declareVariables(g,b)}
    ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${y}`},p=[{type:12,data:d},...W(e,n)];return{name:"Expand",shaderCache:{hint:`${n.length};${u}${s}`,inputDependencies:["rank"]},getShaderSource:c,getRunData:()=>({outputs:[{dims:n,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:p})}},Cl=t=>{Fg(t.inputs),t.compute(Kg(t.inputs),{inputs:[0]})}});var jg,kl,Pl=V(()=>{"use strict";X();te();oe();pn();jg=t=>{let e=t[0].dataType,r=k.size(t[0].dims),n=k.size(t[1].dims),o=n%4===0,i=u=>{let s=O("x",e,[1],4),d=O("bias",e,[1],4),c=R("y",e,[1],4),p=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],f=b=>`
      let bias${b}_offset: u32 = (global_idx * 4 + ${b}) % uniforms.bias_size;
      let bias${b} = ${d.getByOffset(`bias${b}_offset / 4`)}[bias${b}_offset % 4];`,g=o?`
      let bias = ${d.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${f(0)}${f(1)}${f(2)}${f(3)}
      let bias = ${s.type.value}(bias0, bias1, bias2, bias3);`;return`${u.registerUniforms(p).declareVariables(s,d,c)}

    ${Co(Ee(e))}

    ${u.mainStart(Ut)}
      ${u.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${s.getByOffset("global_idx")};
      ${g}
      let x_in = x + bias;
      ${c.setByOffset("global_idx",Eo("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${o}`,inputDependencies:["type","type"]},getShaderSource:i,getRunData:u=>({outputs:[{dims:u[0].dims,dataType:u[0].dataType}],programUniforms:[{type:12,data:Math.ceil(r/4)},{type:12,data:n}],dispatchGroup:{x:Math.ceil(r/Ut/4)}})}},kl=t=>{t.inputs.length<2||k.size(t.inputs[1].dims)===0?bd(t):t.compute(jg(t.inputs))}});var Zg,Qg,Ol,Dl,Bl=V(()=>{"use strict";X();te();Ie();oe();Zg=t=>{if(!t||t.length!==2)throw new Error("Gather requires 2 inputs.")},Qg=(t,e)=>{let r=t[0].dims,n=t[1].dims,o=r.length,i=k.normalizeAxis(e.axis,o),u=r.slice(0);u.splice(i,1,...n);let s=r[i],d=t[0].dataType===9?4:1,c=Math.ceil(k.size(u)/d),p=[{type:12,data:c},{type:6,data:s},{type:12,data:i},...W(t[0].dims,t[1].dims,u)],f=g=>{let b=O("data",t[0].dataType,t[0].dims.length,d),y=O("inputIndices",t[1].dataType,t[1].dims.length),$=R("output",t[0].dataType,u.length,d),T=w=>{let S=n.length,I=`var indicesIndices${w}  = ${y.type.indices}(0);`;for(let C=0;C<S;C++)I+=`${S>1?`indicesIndices${w}[${C}]`:`indicesIndices${w}`} = ${u.length>1?`outputIndices${w}[uniforms.axis + ${C}]`:`outputIndices${w}`};`;I+=`
          var idx${w} = ${y.getByIndices(`indicesIndices${w}`)};
          if (idx${w} < 0) {
            idx${w} = idx${w} + uniforms.axisDimLimit;
          }
          var dataIndices${w} : ${b.type.indices};
        `;for(let C=0,E=0;C<o;C++)C===i?(I+=`${o>1?`dataIndices${w}[${C}]`:`dataIndices${w}`} = u32(idx${w});`,E+=S):(I+=`${o>1?`dataIndices${w}[${C}]`:`dataIndices${w}`} = ${u.length>1?`outputIndices${w}[${E}]`:`outputIndices${w}`};`,E++);return I},_;if(t[0].dataType===9){let w=(S,I,C="")=>`
          let outputIndices${I} = ${$.offsetToIndices(`outputOffset + ${I}u`)};
          ${T(I)};
          let offset${I} = ${b.indicesToOffset(`dataIndices${I}`)};
          let index${I} = offset${I} / 4u;
          let component${I} = offset${I} % 4u;
          ${S}[${I}] = ${C}(${b.getByOffset(`index${I}`)}[component${I}]);
        `;_=`
        let outputOffset = global_idx * ${d};
        var value = vec4<u32>(0);
        ${w("value",0,"u32")}
        ${w("value",1,"u32")}
        ${w("value",2,"u32")}
        ${w("value",3,"u32")}
        ${$.setByOffset("global_idx","value")}
      `}else _=`
      let outputIndices = ${$.offsetToIndices("global_idx")};
      ${T("")};
      let value = ${b.getByIndices("dataIndices")};
      ${$.setByOffset("global_idx","value")};
      `;return`
      ${g.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(b,y,$)}
      ${g.mainStart()}
        ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${_}
      }`};return{name:"Gather",shaderCache:{hint:e.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:u,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:p}),getShaderSource:f}},Ol=t=>Q({axis:t.axis}),Dl=(t,e)=>{let r=t.inputs;Zg(r),t.compute(Qg(t.inputs,e))}});var Yg,zl,Ml,Rl=V(()=>{"use strict";X();te();oe();Yg=(t,e,r,n,o,i,u,s,d)=>{let c=[{type:12,data:i},{type:12,data:n},{type:12,data:o},{type:12,data:r},{type:12,data:u},{type:12,data:s},{type:12,data:d}],p=[i];c.push(...W(e.dims,p));let f=g=>{let b=O("indices_data",e.dataType,e.dims.length),y=R("input_slice_offsets_data",12,1,1),$=[b,y],T=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:o.length},{name:"sizes_from_slice_dims_data",type:"u32",length:r.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${g.registerUniforms(T).declareVariables(...$)}
  ${g.mainStart()}
    ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${o.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return t.compute({name:"computeSliceOffsets",shaderCache:{hint:`${o.length}_${r.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:p,dataType:t.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:c}),getShaderSource:f},{inputs:[e],outputs:[-1]})[0]},zl=(t,e)=>{let r=t.inputs,n=r[0].dims,o=r[0].dataType,i=r[1].dims,u=i[i.length-1],s=k.sizeToDimension(i,i.length-1),d=k.sizeFromDimension(n,e.batchDims+u),c=k.sizeToDimension(n,e.batchDims),p=k.sizeFromDimension(n,e.batchDims),f=s/c,g=new Array(u),b=d;for(let I=0;I<u;++I)g[u-1-I]=b,b*=n[e.batchDims+u-1-I];let y=Yg(t,r[1],g,e.batchDims,n,s,f,p,u),$=e.batchDims+u;if($>n.length)throw new Error("last dimension of indices must not be larger than rank of input tensor");let T=i.slice(0,-1).concat(n.slice($)),_=k.size(T),w=[{type:12,data:_},{type:12,data:d},...W(r[0].dims,y.dims,T)],S=I=>{let C=O("data",r[0].dataType,r[0].dims.length),E=O("slice_offsets",12,y.dims.length),B=R("output",r[0].dataType,T.length);return`
          ${I.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(C,E,B)}
            ${I.mainStart()}
            ${I.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};t.compute({name:"GatherND",shaderCache:{hint:e.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:T,dataType:o}],dispatchGroup:{x:Math.ceil(_/64)},programUniforms:w}),getShaderSource:S},{inputs:[r[0],y]})},Ml=t=>({batchDims:t.batch_dims,cacheKey:""})});var Xg,Jg,Ul,Nl,Vl=V(()=>{"use strict";X();te();Ie();oe();Xg=(t,e)=>{if(t.length<3||t.length>4)throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");let r=k.normalizeAxis(e.quantizeAxis,t[0].dims.length),n=e.blockSize,o=t[0],i=t[2],u=t.length===4?t[3]:void 0;if(i.dims.length!==o.dims.length||!o.dims.map((s,d)=>d===r?Math.ceil(s/n)===i.dims[d]:s===i.dims[d]).reduce((s,d)=>s&&d,!0))throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(u){if(u.dataType!==o.dataType)throw new Error("Zero point must have the same data type as the input tensor.");if(u.dims.length!==i.dims.length||!u.dims.map((s,d)=>s===i.dims[d]).reduce((s,d)=>s&&d,!0))throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},Jg=(t,e)=>{let r=t[0].dims,n=t[1].dims,o=r.length,i=k.normalizeAxis(e.gatherAxis,o),u=k.normalizeAxis(e.quantizeAxis,o),s=r.slice(0);s.splice(i,1,...n);let d=k.size(s),c=t[2].dataType,f=t[0].dataType===22,g=[{type:12,data:d},{type:12,data:u},{type:12,data:i},{type:12,data:e.blockSize},...W(...t.map((y,$)=>y.dims),s)],b=y=>{let $=O("data",t[0].dataType,t[0].dims.length),T=O("inputIndices",t[1].dataType,t[1].dims.length),_=O("scales",t[2].dataType,t[2].dims.length),w=t.length>3?O("zeroPoint",t[3].dataType,t[3].dims.length):void 0,S=R("output",c,s.length),I=[$,T,_];w&&I.push(w);let C=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${y.registerUniforms(C).declareVariables(...I,S)}
        ${y.mainStart()}
        let output_indices = ${S.offsetToIndices("global_idx")};
        var indices_indices = ${T.type.indices}(0);
        ${n.length>1?`
          for (var i: u32 = 0; i < ${n.length}; i++) {
            let index = ${S.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${T.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${S.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${$.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${S.indicesGet("output_indices","i")};
          ${$.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${T.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[i]};
        }
        ${$.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${s.length}; i++) {
          let index = ${S.indicesGet("output_indices",`i + ${n.length} - 1`)};
          ${$.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${$.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${$.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${f?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${_.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${_.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${_.getByIndices("scale_indices")};
        ${w?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${w.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${w.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${f?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${Ee(c)}(quantized_data - zero_point) * scale;
        ${S.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${e.cacheKey};${t.filter((y,$)=>$!==1).map(y=>y.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:t.length},(y,$)=>"rank")},getRunData:()=>({outputs:[{dims:s,dataType:c}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:g}),getShaderSource:b}},Ul=(t,e)=>{let r=t.inputs;Xg(r,e),t.compute(Jg(t.inputs,e))},Nl=t=>Q({blockSize:t.blockSize,gatherAxis:t.gatherAxis,quantizeAxis:t.quantizeAxis})});var ey,ty,Ll,Wl,Gl=V(()=>{"use strict";X();te();Ie();oe();ey=t=>{if(!t||t.length!==2)throw new Error("GatherElements requires 2 inputs.");if(t[0].dims.length<1)throw new Error("GatherElements requires that the data input be rank >= 1.");if(t[0].dims.length!==t[1].dims.length)throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},ty=(t,e)=>{let r=t[0].dims,n=t[0].dataType,o=r.length,i=t[1].dims,u=t[1].dataType,s=k.normalizeAxis(e.axis,o),d=r[s],c=i.slice(0),p=k.size(c),f=O("input",n,o),g=O("indicesInput",u,i.length),b=R("output",n,c.length),y=[{type:12,data:p},{type:6,data:d},{type:12,data:s}];return y.push(...W(r,i,c)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:c,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:y}),getShaderSource:_=>`
      ${_.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(f,g,b)}
      ${_.mainStart()}
      ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${b.offsetToIndices("global_idx")};

      var idx = ${g.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${f.type.indices}(outputIndices);
      ${f.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${f.getByIndices("inputIndices")};

      ${b.setByOffset("global_idx","value")};
  }`}},Ll=t=>Q({axis:t.axis}),Wl=(t,e)=>{let r=t.inputs;ey(r),t.compute(ty(t.inputs,e))}});var ry,ny,Hl,Fl,ql=V(()=>{"use strict";X();te();oe();ry=t=>{if(!t)throw new Error("Input is missing");if(t.length<2||t.length>3)throw new Error("Invaid input number.");if(t.length===3&&t[2].dims.length>2)throw new Error("Invalid input shape of C");if(t[0].dataType!==t[1].dataType||t.length===3&&t[0].dataType!==t[2].dataType)throw new Error("Input types are mismatched")},ny=(t,e)=>{let r=t[0].dims.slice(),n=t[1].dims.slice(),[o,i,u]=Xr.getShapeOfGemmResult(r,e.transA,n,e.transB,t.length===3?t[2].dims:void 0),s=[o,i];if(!s)throw new Error("Can't use gemm on the given tensors");let d=16,c=Math.ceil(i/d),p=Math.ceil(o/d),f=!0,g=k.size(s),b=[{type:12,data:f?c:g},{type:12,data:o},{type:12,data:i},{type:12,data:u},{type:1,data:e.alpha},{type:1,data:e.beta}],y=["type","type"];t.length===3&&(b.push(...W(t[2].dims)),y.push("rank")),b.push(...W(s));let $=_=>{let w="";e.transA&&e.transB?w="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":e.transA&&!e.transB?w="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!e.transA&&e.transB?w="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!e.transA&&!e.transB&&(w="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let S=e.alpha===1?"":"value *= uniforms.alpha;",I=O("a",t[0].dataType,t[0].dims),C=O("b",t[1].dataType,t[1].dims),E=I.type.value,B=null,x=[I,C];t.length===3&&(B=O("c",t[2].dataType,t[2].dims.length),x.push(B));let U=R("output",t[0].dataType,s.length);x.push(U);let N=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${_.registerUniforms(N).declareVariables(...x)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${E}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${w}
    }

    ${S}
    ${B!=null?`let cOffset = ${B.broadcastedIndicesToOffset("vec2(m, n)",U)}; value += ${E}(uniforms.beta) * ${B.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},T=_=>{let w=O("a",t[0].dataType,t[0].dims),S=O("b",t[1].dataType,t[1].dims),I=null,C=[w,S];t.length===3&&(I=O("c",t[2].dataType,t[2].dims.length),C.push(I));let E=R("output",t[0].dataType,s.length);C.push(E);let B=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],x="",U="";e.transA&&e.transB?(U=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${w.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,x="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):e.transA&&!e.transB?(U=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${w.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,x="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!e.transA&&e.transB?(U=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${w.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,x="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!e.transA&&!e.transB&&(U=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${w.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,x="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let N=e.alpha===1?"":"value *= uniforms.alpha;";return`
  ${_.registerUniforms(B).declareVariables(...C)}
  var<workgroup> tile_a: array<array<${w.type.storage}, ${d}>, ${d}>;
  var<workgroup> tile_b: array<array<${S.type.storage}, ${d}>, ${d}>;
  ${_.mainStart([d,d,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${d};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${d};
    let num_tiles = (uniforms.K - 1) / ${d} + 1;
    var k_start = 0u;
    var value = ${E.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${U}
      k_start = k_start + ${d};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${d}; k++) {
        ${x}
      }
      workgroupBarrier();
    }

    ${N}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${I!=null?`let cOffset = ${I.broadcastedIndicesToOffset("vec2(m, n)",E)}; value += ${E.type.value}(uniforms.beta) * ${I.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return f?{name:"GemmShared",shaderCache:{hint:`${e.cacheKey}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:s,dataType:t[0].dataType}],dispatchGroup:{x:c*p},programUniforms:b}),getShaderSource:T}:{name:"Gemm",shaderCache:{hint:`${e.cacheKey}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:s,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:b}),getShaderSource:$}},Hl=t=>{let e=t.transA,r=t.transB,n=t.alpha,o=t.beta;return{transA:e,transB:r,alpha:n,beta:o,cacheKey:`${t.transA};${t.transB};${t.alpha===1}`}},Fl=(t,e)=>{ry(t.inputs),t.compute(ny(t.inputs,e))}});var mt,Et,Zt,Qt,oy,iy,ay,sy,uy,dy,ly,cy,Kl,jl,Zl=V(()=>{"use strict";X();te();Ie();oe();[mt,Et,Zt,Qt]=[0,1,2,3],oy=t=>{if(t[0].dims.length!==4)throw new Error("only 4-D tensor is supported.");if(t[0].dims.length!==t[1].dims.length)throw new Error("input dimensions must be equal to grid dimensions");if(t[0].dims.length-2!==t[1].dims[t[1].dims.length-1])throw new Error(`last dimension of grid must be equal to ${t[0].dims.length-2}`);if(t[0].dims[0]!==t[1].dims[0])throw new Error("grid batch size must match input batch size")},iy=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,ay=t=>`
  fn gs_bicubic_interpolate(p: mat4x4<${t}>, x: f32, y: f32) -> ${t} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${t}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,sy=t=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${t.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,uy=t=>`
  ${t.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,dy=(t,e,r)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${e} {
     var pixel = ${e}(0);
     var indices = vec4<u32>(0);
     indices[${mt}] = batch;
     indices[${Et}] = channel;`+(()=>{switch(r.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${Zt}] = u32(r);
            indices[${Qt}] = u32(c);
          } else {
            return ${e}(0);
          }
        `;case"border":return`
          indices[${Zt}] = u32(clamp(r, 0, H - 1));
          indices[${Qt}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${Zt}] = gs_reflect(r, border[1], border[3]);
          indices[${Qt}] = gs_reflect(c, border[0], border[2]);
        `;default:throw new Error(`padding mode ${r.paddingMode} is not supported`)}})()+`
    return ${t.getByIndices("indices")};
  }
`,ly=(t,e,r)=>(()=>{switch(r.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${mt}], indices[${Et}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${mt}], indices[${Et}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${mt}], indices[${Et}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${mt}], indices[${Et}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${mt}], indices[${Et}], border);

          let dx2 = ${e}(f32(x2) - x);
          let dx1 = ${e}(x - f32(x1));
          let dy2 = ${e}(f32(y2) - y);
          let dy1 = ${e}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${e}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${mt}], indices[${Et}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw new Error(`mode ${r.mode} is not supported`)}})()+`${t.setByOffset("global_idx","result")}`,cy=(t,e)=>{let r=O("x",t[0].dataType,t[0].dims.length),n=[t[1].dims[0],t[1].dims[1],t[1].dims[2]],o=O("grid",t[1].dataType,n.length,2),i=[t[0].dims[0],t[0].dims[1],t[1].dims[1],t[1].dims[2]];e.format==="NHWC"&&(i=[t[0].dims[0],t[1].dims[1],t[1].dims[2],t[0].dims[3]],[mt,Et,Zt,Qt]=[0,3,1,2]);let u=R("output",t[0].dataType,i.length),s=r.type.value,d=k.size(i),c=[{type:12,data:d},...W(t[0].dims,n,i)],p=f=>`
  ${f.registerUniform("output_size","u32").declareVariables(r,o,u)}
  ${iy}
  ${ay(s)}
  ${sy(e)}
  ${uy(e)}
  ${dy(r,s,e)}

  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${Zt}]);
      let W_in = i32(uniforms.x_shape[${Qt}]);

      ${e.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${u.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${mt}], indices[${Zt}], indices[${Qt}]);
      let nxy = ${o.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${ly(u,s,e)}
  }`;return{name:"GridSample",shaderCache:{hint:`${e.cacheKey}`,inputDependencies:["type","type"]},getRunData:f=>{let g=k.size(i);return{outputs:[{dims:i,dataType:f[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:c}},getShaderSource:p}},Kl=(t,e)=>{oy(t.inputs),t.compute(cy(t.inputs,e))},jl=t=>Q({alignCorners:t.align_corners,mode:t.mode,paddingMode:t.padding_mode,format:t.format})});var Le,fy,Yl,Ql,hy,hr,Xl,Vo=V(()=>{"use strict";X();te();Ie();on();ln();oe();pt();Le=(t,e)=>t.length>e&&t[e].dims.length>0?t[e]:void 0,fy=(t,e)=>{let r=t[0],n=Le(t,1),o=Le(t,2),i=Le(t,3),u=Le(t,4),s=Le(t,5),d=Le(t,6),c=Le(t,7);if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let p=r.dims[0],f=r.dims[1],g=r.dims.length===3?r.dims[2]:e.numHeads*r.dims[4],b=f,y=0,$=0,T=Math.floor(g/e.numHeads);if(d&&c&&k.size(d.dims)&&k.size(c.dims)){if(d.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(d.dims[0]!==p||d.dims[1]!==e.numHeads||d.dims[3]!==T)throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(c.dims[0]!==p||c.dims[1]!==e.numHeads||c.dims[3]!==T)throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(d.dims[2]!==c.dims[2])throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(c.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');y=d.dims[2],$=d.dims[2]}else if(d&&k.size(d.dims)||c&&k.size(c.dims))throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let _;if(n&&k.size(n.dims)>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(n.dims.length<3||n.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==n.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(n.dims.length===3){if(n.dims[2]!==r.dims[2])throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');_=2,b=n.dims[1]}else if(n.dims.length===5){if(n.dims[2]!==e.numHeads||n.dims[3]!==2||n.dims[4]!==T)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(o)throw new Error('Expect "value" be none when "key" has packed kv format.');_=5,b=n.dims[1]}else{if(n.dims[1]!==e.numHeads||n.dims[3]!==T)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');_=0,b=n.dims[2]}}else{if(r.dims.length!==5)throw new Error('Input "query" is expected to have 5 dimensions when key is empty');if(r.dims[2]!==e.numHeads||r.dims[3]!==3)throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');_=3}if(i&&k.size(i.dims)>0){if(i.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimension');if(n&&n.dims.length===5&&n.dims[3]===2)throw new Error("bias is not allowed for packed kv.")}let w=y+b,S=0;if(u&&k.size(u.dims)>0){S=8;let B=u.dims;throw B.length===1?B[0]===p?S=1:B[0]===3*p+2&&(S=3):B.length===2&&B[0]===p&&B[1]===w&&(S=5),S===8?new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):new Error("Mask not supported")}let I=!1,C=g;if(o&&k.size(o.dims)>0){if(o.dims.length!==3&&o.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==o.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(o.dims.length===3){if(b!==o.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');C=o.dims[2]}else{if(b!==o.dims[2])throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');C=o.dims[1]*o.dims[3],I=!0}}let E=!1;if(u&&k.size(u.dims)>0)throw new Error("Key padding mask is not supported");if(s&&k.size(s.dims)>0){if(s.dims.length!==4)throw new Error('Input "attention_bias" is expected to have 4 dimensions');if(s.dims[0]!==p||s.dims[1]!==e.numHeads||s.dims[2]!==f||s.dims[3]!==w)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:p,sequenceLength:f,pastSequenceLength:y,kvSequenceLength:b,totalSequenceLength:w,maxSequenceLength:$,inputHiddenSize:0,hiddenSize:g,vHiddenSize:C,headSize:T,vHeadSize:Math.floor(C/e.numHeads),numHeads:e.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:e.maskFilterValue,maskType:S,scale:e.scale,broadcastResPosBias:E,passPastInKv:I,qkvFormat:_}},Yl=t=>Q({...t}),Ql=Q({perm:[0,2,1,3]}),hy=(t,e,r,n,o,i,u)=>{let s=[n,o,i],d=k.size(s),c=[{type:12,data:d},{type:12,data:u},{type:12,data:i}],p=f=>{let g=R("qkv_with_bias",e.dataType,s),b=O("qkv",e.dataType,s),y=O("bias",r.dataType,s),$=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${f.registerUniforms($).declareVariables(b,y,g)}
  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return t.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:s,dataType:e.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:c}),getShaderSource:p},{inputs:[e,r],outputs:[-1]})[0]},hr=(t,e,r,n,o,i,u,s)=>{let d=i;if(u&&k.size(u.dims)>0){if(n===1)throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return d=hy(t,i,u,e,n,r*o,s),d=d.reshape([e,n,r,o]),r===1||n===1?d:t.compute(ze(d,Ql.perm),{inputs:[d],outputs:[-1]})[0]}else return i.dims.length===3&&(d=i.reshape([e,n,r,o])),r===1||n===1?d:t.compute(ze(d,Ql.perm),{inputs:[d],outputs:[-1]})[0]},Xl=(t,e)=>{let r=fy(t.inputs,e),n=t.inputs[0],o=Le(t.inputs,1),i=Le(t.inputs,2),u=Le(t.inputs,3),s=Le(t.inputs,4),d=Le(t.inputs,5),c=Le(t.inputs,6),p=Le(t.inputs,7);if(n.dims.length===5)throw new Error("Packed QKV is not implemented");if(o?.dims.length===5)throw new Error("Packed KV is not implemented");let f=o&&i&&o.dims.length===4&&i.dims.length===4,g=hr(t,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,n,u,0);if(f)return jt(t,g,o,i,s,void 0,c,p,d,r);if(!o||!i)throw new Error("key and value must be provided");let b=hr(t,r.batchSize,r.numHeads,r.kvSequenceLength,r.headSize,o,u,r.hiddenSize),y=hr(t,r.batchSize,r.numHeads,r.kvSequenceLength,r.vHeadSize,i,u,2*r.hiddenSize);jt(t,g,b,y,s,void 0,c,p,d,r)}});var gy,yy,by,_y,Lo,Jl,ec,Wo=V(()=>{"use strict";X();te();Ie();oe();gy=t=>{if(!t||t.length<1)throw new Error("too few inputs")},yy=(t,e)=>{let r=[],n=e.numOutputs;return t[1].dims[0]>0&&(t[1].getBigInt64Array().forEach(o=>r.push(Number(o))),n=r.length),Q({numOutputs:n,axis:e.axis,splitSizes:r})},by=t=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${t}u; i += 1u ) {
    if (index < ${K("uniforms.size_in_split_axis","i",t)}) {
        return i;
    }
    }
    return ${t}u;
}`,_y=t=>{let e=t.length,r=[];for(let n=0;n<e;++n){let o=t[n].setByIndices("indices","input[global_idx]");e===1?r.push(o):n===0?r.push(`if (output_number == ${n}u) { ${o} }`):n===e-1?r.push(`else { ${o} }`):r.push(`else if (output_number == ${n}) { ${o} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${t[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`},Lo=(t,e)=>{let r=t[0].dims,n=k.size(r),o=t[0].dataType,i=k.normalizeAxis(e.axis,r.length),u=new Array(e.numOutputs),s=O("input",o,r.length),d=new Array(e.numOutputs),c=[],p=[],f=0,g=[{type:12,data:n}];for(let y=0;y<e.numOutputs;y++){f+=e.splitSizes[y],d[y]=f;let $=r.slice();$[i]=e.splitSizes[y],p.push($),u[y]=R(`output${y}`,o,$.length),c.push({dims:p[y],dataType:t[0].dataType})}g.push({type:12,data:d},...W(r,...p));let b=y=>`
  ${y.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",d.length).declareVariables(s,...u)}
  ${by(d.length)}
  ${_y(u)}

  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${s.offsetToIndices("global_idx")};
    var index = ${s.indicesGet("indices",i)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${K("uniforms.size_in_split_axis","output_number - 1u",d.length)};
      ${s.indicesSet("indices",i,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:e.cacheKey,inputDependencies:["rank"]},getShaderSource:b,getRunData:()=>({outputs:c,dispatchGroup:{x:Math.ceil(n/64)},programUniforms:g})}},Jl=(t,e)=>{gy(t.inputs);let r=t.inputs.length===1?e:yy(t.inputs,e);t.compute(Lo(t.inputs,r),{inputs:[0]})},ec=t=>{let e=t.axis,r=t.splitSizes,n=t.numOutputs<0?r.length:t.numOutputs;if(n!==r.length)throw new Error("numOutputs and splitSizes length must be equal");return Q({axis:e,numOutputs:n,splitSizes:r})}});var wy,vn,tc,Go=V(()=>{"use strict";X();te();Ie();oe();wy=(t,e)=>{let[r,n,o,i]=t,{numHeads:u,rotaryEmbeddingDim:s}=e;if(r.dims.length!==3&&r.dims.length!==4)throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);if(!k.areEqual(n.dims,[])&&!k.areEqual(n.dims,[1])&&n.dims.length!==2)throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${n.dims.length}`);if(o.dims.length!==2)throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${o.dims.length}`);if(i.dims.length!==2)throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${i.dims.length}`);if(!k.areEqual(o.dims,i.dims))throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(s>0&&u===0)throw new Error("num_heads must be provided if rotary_embedding_dim is specified");let d=r.dims[0],c=r.dims[r.dims.length-2],p=o.dims[0],f=k.sizeFromDimension(r.dims,1)/c,g=s===0?o.dims[1]*2:f/u;if(s>g)throw new Error("rotary_embedding_dim must be less than or equal to head_size");if(n.dims.length===2){if(d!==n.dims[0])throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${n.dims[0]}`);if(c!==n.dims[1])throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${n.dims[1]}`)}if(c>p)throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported");if(g/2!==o.dims[1]&&s/2!==o.dims[1])throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${o.dims[1]}`)},vn=(t,e)=>{let{interleaved:r,numHeads:n,rotaryEmbeddingDim:o,scale:i}=e,u=t[0].dims[0],s=k.sizeFromDimension(t[0].dims,1),d=t[0].dims[t[0].dims.length-2],c=s/d,p=t[2].dims[1],f=o===0?p*2:c/n,g=new Array(u,d,c/f,f-p),b=k.computeStrides(g),y=[{type:1,data:i},{type:12,data:g},{type:12,data:b},...t[0].dims.length===3?new Array({type:12,data:[s,c,f,1]}):[],...t[0].dims.length===4?new Array({type:12,data:[s,f,d*f,1]}):[],...W(t[0].dims,t[1].dims,t[2].dims,t[3].dims,t[0].dims)],$=T=>{let _=O("input",t[0].dataType,t[0].dims.length),w=O("position_ids",t[1].dataType,t[1].dims.length),S=O("cos_cache",t[2].dataType,t[2].dims.length),I=O("sin_cache",t[3].dataType,t[3].dims.length),C=R("output",t[0].dataType,t[0].dims.length);return T.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:g.length},{name:"global_strides",type:"u32",length:b.length},{name:"input_output_strides",type:"u32",length:b.length}]),`
        ${T.declareVariables(_,w,S,I,C)}

        ${T.mainStart(Ut)}
          let half_rotary_emb_dim = uniforms.${S.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${T.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${w.broadcastedIndicesToOffset("bsnh.xy",R("",w.type.tensor,2))};
            let position_id =
                u32(${w.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${_.getByOffset("i")} * ${S.get("position_id","bsnh[3]")} -
                ${_.getByOffset("j")} * ${I.get("position_id","bsnh[3]")};
            ${C.setByOffset("i","re")}
            let im = ${_.getByOffset("i")} * ${I.get("position_id","bsnh[3]")} +
                ${_.getByOffset("j")} * ${S.get("position_id","bsnh[3]")};
            ${C.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${C.setByOffset("k",_.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:Q({interleaved:r}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:$,getRunData:()=>({outputs:[{dims:t[0].dims,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(k.size(g)/Ut)},programUniforms:y})}},tc=(t,e)=>{wy(t.inputs,e),t.compute(vn(t.inputs,e))}});var vy,$y,rc,xy,nc,oc=V(()=>{"use strict";Ie();X();ln();Vo();Wo();pt();Go();oe();vy=(t,e)=>{if(e.doRotary&&t.length<=7)throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let r=t[0],n=t[1],o=t[2],i=t[3],u=t[4];if(e.doRotary!==0&&t.length<=7)throw new Error("cos_cast and sin_cache are expected if do_rotary attribute is non-zero");if(e.localWindowSize!==-1)throw new Error("Local attention is not supported");if(e.softcap!==0)throw new Error("Softcap is not supported");if(e.rotaryInterleaved!==0)throw new Error("Rotary interleaved is not supported");if(e.smoothSoftmax)throw new Error("Smooth softmax is not supported");if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let s=!1,d=r.dims[0],c=r.dims[1],p=r.dims.length===3?s?r.dims[2]/3:r.dims[2]:e.numHeads*r.dims[4],f=c,g=0,b=!n||n.dims.length===0,y=Math.floor(b?p/(e.numHeads+2*e.kvNumHeads):p/e.numHeads);b&&(p=y*e.numHeads);let $=i&&i.dims.length!==0,T=u&&u.dims.length!==0;if($&&i.dims.length===4&&i.dims[0]===d&&i.dims[1]!==e.kvNumHeads&&i.dims[2]===e.kvNumHeads&&i.dims[3]===y)throw new Error("BSNH pastKey/pastValue is not supported");if($&&T){if(i.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(u.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');g=i.dims[2]}else if($||T)throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let w=1;if(n&&n.dims.length>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(n.dims.length<3||n.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==n.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(n.dims.length===3){if(r.dims[2]%n.dims[2]!==0)throw new Error('Dimension 2 of "query" should be a multiple of "key"');f=n.dims[1]}else if(n.dims.length===5){if(n.dims[2]!==e.numHeads||n.dims[3]!==2||n.dims[4]!==y)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(o)throw new Error('Expect "value" be none when "key" has packed kv format.');f=n.dims[1]}else{if(n.dims[1]!==e.numHeads||n.dims[3]!==y)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');f=n.dims[2]}}else{if(r.dims.length!==3&&r.dims.length!==5)throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(r.dims.length===5&&(r.dims[2]!==e.numHeads||r.dims[3]!==3))throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');w=3}let S=0,I=!1,C=e.kvNumHeads?y*e.kvNumHeads:p;if(o&&o.dims.length>0){if(o.dims.length!==3&&o.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==o.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(o.dims.length===3){if(f!==o.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');C=o.dims[2]}else{if(f!==o.dims[2])throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');C=o.dims[1]*o.dims[3],I=!0}}let E=t.length>4?t[5]:void 0;if(E){if(E.dims.length===0)throw new Error("seqlens_k must be at least 1D, got scalar.");let N=E.dims.reduce((F,Z)=>F*Z,1);if(N!==d)throw new Error(`seqlens_k must have batch_size (${d}) elements, got ${N}.`);for(let F=0;F<E.dims.length;F++)if(E.dims[F]!==1&&E.dims[F]!==d)throw new Error(`seqlens_k has unexpected shape. Each dimension must be 1 or batch_size (${d}), got dims[${F}] = ${E.dims[F]}.`)}return{batchSize:d,sequenceLength:c,pastSequenceLength:g,kvSequenceLength:f,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:p,vHiddenSize:C,headSize:y,vHeadSize:Math.floor(C/e.kvNumHeads),numHeads:e.numHeads,kvNumHeads:e.kvNumHeads,nReps:e.numHeads/e.kvNumHeads,pastPresentShareBuffer:!1,maskType:S,scale:e.scale,broadcastResPosBias:!1,passPastInKv:I,qkvFormat:w}},$y=Q({perm:[0,2,1,3]}),rc=(t,e,r)=>{let n=e,o=r.kvNumHeads;return e.dims.length===3&&r.kvSequenceLength!==0&&(n=e.reshape([r.batchSize,r.kvSequenceLength,o,r.headSize]),n=t.compute(ze(n,$y.perm),{inputs:[n],outputs:[-1]})[0]),n},xy=(t,e,r,n)=>{let o=7,i=["type","type"],u=[t*e],s=t*e,d=[{type:12,data:s},{type:12,data:e},{type:12,data:t}],c=p=>{let f=O("seq_lens",r.dataType,r.dims),g=O("total_seq_lens",n.dataType,n.dims),b=R("pos_ids",o,u),y=[{name:"output_size",type:"u32"},{name:"sequence_length",type:"u32"},{name:"batch_size",type:"u32"}];return`
  ${p.registerUniforms(y).declareVariables(f,g,b)}
  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let total_sequence_length = u32(${g.getByOffset("0")});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${f.getByOffset("batch_idx")};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${b.setByOffset("global_idx","pos_id")}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${b.setByOffset("global_idx","pos_id")}
    } else if (global_idx < uniforms.batch_size) {
      ${b.setByOffset("global_idx","seqlen")}
    };
  }
  `};return{name:"GeneratePositionIds",shaderCache:{hint:`${t};${e}`,inputDependencies:i},getRunData:()=>({outputs:[{dims:u,dataType:o}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:d}),getShaderSource:c}},nc=(t,e)=>{if(t.inputs.length>14&&t.inputs[14]||t.inputs.length>15&&t.inputs[15])throw new Error("GroupQueryAttention (JSEP): q_norm_weight / k_norm_weight inputs are not supported. The per-head Q/K RMS normalization prologue is implemented only on the CUDA and native WebGPU EPs.");let r=vy(t.inputs,e);if(t.inputs[0].dims.length===5)throw new Error("Packed QKV is not implemented");if(t.inputs[1]?.dims.length===5)throw new Error("Packed KV is not implemented");let n=t.inputs[0],o=t.inputs[1]&&t.inputs[1].dims.length>0?t.inputs[1]:void 0,i=t.inputs[2]&&t.inputs[2].dims.length>0?t.inputs[2]:void 0,u=t.inputs[3]&&t.inputs[3].dims.length!==0?t.inputs[3]:void 0,s=t.inputs[4]&&t.inputs[4].dims.length!==0?t.inputs[4]:void 0,d=t.inputs.length>4?t.inputs[5]:void 0,c=t.inputs.length>5?t.inputs[6]:void 0,p=r.kvNumHeads?r.kvNumHeads:r.numHeads,f=Q({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,p*r.headSize,p*r.headSize]}),[g,b,y]=!o&&!i?t.compute(Lo([n],f),{inputs:[n],outputs:[-1,-1,-1]}):[n,o,i],$,T;if(e.doRotary){let I=t.compute(xy(r.batchSize,r.sequenceLength,d,c),{inputs:[d,c],outputs:[-1]})[0],C=t.inputs[7],E=t.inputs[8],B=Q({interleaved:e.rotaryInterleaved!==0,numHeads:r.numHeads,rotaryEmbeddingDim:0,scale:e.scale}),x=[g,I,C,E],U=[-1];$=t.compute(vn(x,B),{inputs:x,outputs:U})[0],x.splice(0,1,b);let N=Q({interleaved:e.rotaryInterleaved!==0,numHeads:r.kvNumHeads,rotaryEmbeddingDim:0,scale:e.scale});T=t.compute(vn(x,N),{inputs:x,outputs:U})[0]}let _=hr(t,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,e.doRotary?$:g,void 0,0),w=rc(t,e.doRotary?T:b,r),S=rc(t,y,r);jt(t,_,w,S,void 0,void 0,u,s,void 0,r,d,c)}});var ic,Sy,Ty,ac,sc=V(()=>{"use strict";X();te();pt();oe();ic=(t,e,r,n,o,i,u,s)=>{let d=_e(i),c=d===1?"f32":`vec${d}f`,p=d===1?"vec2f":`mat2x${d}f`,f=o*u,g=64;f===1&&(g=256);let b=[o,u,i/d],y=[o,u,2],$=["rank","type","type"],T=[];T.push(...W(b,y));let _=w=>{let S=O("x",e.dataType,3,d),I=O("scale",r.dataType,r.dims),C=O("bias",n.dataType,n.dims),E=R("output",1,3,2),B=[S,I,C,E];return`
  var<workgroup> workgroup_shared : array<${p}, ${g}>;
  const workgroup_size = ${g}u;
  ${w.declareVariables(...B)}
  ${w.mainStart(g)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${c}(0);
    var squared_sum = ${c}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${c}(${S.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${p}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${Ze("workgroup_shared[0][0]",d)} / f32(hight * ${d});
      let squared_sum_final = ${Ze("workgroup_shared[0][1]",d)} / f32(hight * ${d});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${s}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return t.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${d};${s};${g}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:y,dataType:1}],dispatchGroup:{x:f},programUniforms:T}),getShaderSource:_},{inputs:[e,r,n],outputs:[-1]})[0]},Sy=(t,e,r)=>{let n=e[0].dims,o=n,i=2,u=n[0],s=n[1],d=k.sizeFromDimension(n,i),c=_e(d),p=k.size(o)/c,f=ic(t,e[0],e[1],e[2],u,d,s,r.epsilon),g=[u,s,d/c],b=[u,s],y=["type","none"],$=T=>{let _=O("x",e[0].dataType,g.length,c),w=O("scale_shift",1,b.length,2),S=R("output",e[0].dataType,g.length,c),I=[_,w,S];return`
  ${T.registerUniform("output_size","u32").declareVariables(...I)}
  ${T.mainStart()}
  ${T.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${S.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${w.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${_.getByOffset("global_idx")} * ${S.type.value}(scale_shift.x) + ${S.type.value}(scale_shift.y);
      ${S.setByOffset("global_idx","value")};
  }`};t.compute({name:"InstanceNormalization",shaderCache:{hint:`${c}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:[{type:12,data:p},...W(g,b,g)]}),getShaderSource:$},{inputs:[e[0],f]})},Ty=(t,e,r)=>{let n=e[0].dims,o=n,i=n[0],u=n[n.length-1],s=k.sizeFromDimension(n,1)/u,d=_e(u),c=k.size(o)/d,p=[{type:12,data:s},{type:12,data:Math.floor(u/d)}],f=["type","type"],g=!1,b=[0,n.length-1];for(let _=0;_<n.length-2;_++)g=g||n[_+1]!==1,b.push(_+1);g=g&&n[n.length-1]!==1;let y=g?t.compute(ze(t.inputs[0],b),{inputs:[t.inputs[0]],outputs:[-1]})[0]:t.inputs[0].reshape(Array.from({length:n.length},(_,w)=>n[b[w]])),$=ic(t,y,e[1],e[2],i,s,u,r.epsilon),T=_=>{let w=$e(e[0].dataType),S=d===1?"vec2f":`mat${d}x2f`,I=B=>{let x=B===0?"x":"y",U=d===1?"f32":`vec${d}f`;switch(d){case 1:return`${w}(${U}(scale.${x}))`;case 2:return`vec2<${w}>(${U}(scale[0].${x}, scale[1].${x}))`;case 4:return`vec4<${w}>(${U}(scale[0].${x}, scale[1].${x}, scale[2].${x}, scale[3].${x}))`;default:throw new Error(`Not supported compoents ${d}`)}},C=O("input",e[0].dataType,e[0].dims,d),E=R("output",e[0].dataType,o,d);return`
  @group(0) @binding(0) var<storage, read> input : array<${C.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${S}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${E.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${_.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${I(0)}, ${I(1)});
  }`};t.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${d}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:p}),getShaderSource:T},{inputs:[e[0],$]})},ac=(t,e)=>{e.format==="NHWC"?Ty(t,t.inputs,e):Sy(t,t.inputs,e)}});var Iy,Ay,uc,dc=V(()=>{"use strict";X();te();oe();Iy=t=>{if(!t||t.length<2)throw new Error("layerNorm requires at least 2 inputs.")},Ay=(t,e,r)=>{let n=e.simplified,o=t[0].dims,i=t[1],u=!n&&t[2],s=o,d=k.normalizeAxis(e.axis,o.length),c=k.sizeToDimension(o,d),p=k.sizeFromDimension(o,d),f=k.size(i.dims),g=u?k.size(u.dims):0;if(f!==p||u&&g!==p)throw new Error(`Size of X.shape()[axis:] == ${p}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${f} and bias size of ${g}`);let b=[];for(let C=0;C<o.length;++C)C<d?b.push(o[C]):b.push(1);let y=_e(p),$=["type","type"],T=[{type:12,data:c},{type:1,data:p},{type:12,data:Math.floor(p/y)},{type:1,data:e.epsilon}];u&&$.push("type");let _=r>1,w=r>2,S=C=>{let E=$e(t[0].dataType),B=[O("x",t[0].dataType,t[0].dims,y),O("scale",i.dataType,i.dims,y)];u&&B.push(O("bias",u.dataType,u.dims,y)),B.push(R("output",t[0].dataType,s,y)),_&&B.push(R("mean_data_output",1,b)),w&&B.push(R("inv_std_output",1,b));let x=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${C.registerUniforms(x).declareVariables(...B)}
  ${C.mainStart()}
    ${C.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${So("f32",y)};
    var mean_square_vector = ${So("f32",y)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${Nt(E,y,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${Ze("mean_vector",y)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${Ze("mean_square_vector",y)} / uniforms.norm_size ${n?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${Nt(E,y,"x[j + offset]")};
      let f32scale = ${Nt(E,y,"scale[j]")};
      output[j + offset] = ${B[0].type.value}((f32input ${n?"":"- mean"}) * inv_std_dev * f32scale
        ${u?`+ ${Nt(E,y,"bias[j]")}`:""}
      );
    }

    ${_?"mean_data_output[global_idx] = mean":""};
    ${w?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},I=[{dims:s,dataType:t[0].dataType}];return _&&I.push({dims:b,dataType:1}),w&&I.push({dims:b,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${y};${r};${n}`,inputDependencies:$},getRunData:()=>({outputs:I,dispatchGroup:{x:Math.ceil(c/64)},programUniforms:T}),getShaderSource:S}},uc=(t,e)=>{Iy(t.inputs),t.compute(Ay(t.inputs,e,t.outputCount))}});var Cy,lc,cc=V(()=>{"use strict";te();gn();yn();Cy=t=>{if(!t||t.length!==2)throw new Error("MatMul requires 2 inputs.");if(t[0].dims[t[0].dims.length-1]!==t[1].dims[t[1].dims.length-2])throw new Error("shared dimension does not match.")},lc=t=>{Cy(t.inputs);let e=ot.calcShape(t.inputs[0].dims,t.inputs[1].dims,!0);if(!e)throw new Error("Can't use matmul on the given tensors");let r=e[e.length-1],n=t.inputs[0].dims[t.inputs[0].dims.length-1];if(r<8&&n<8)t.compute(hn(t.inputs,{activation:""},e));else{let o=e[e.length-2],i=k.size(t.inputs[0].dims.slice(0,-2)),u=k.size(t.inputs[1].dims.slice(0,-2));if(i!==1&&o===1&&u===1){let s=t.inputs[0].reshape([1,i,n]),d=t.inputs[1].reshape([1,n,r]),c=[1,i,r],p=[s,d];t.compute(fr(p,{activation:""},e,c),{inputs:p})}else t.compute(fr(t.inputs,{activation:""},e))}}});var Ey,ky,Py,pc,mc,fc=V(()=>{"use strict";X();te();Ie();oe();Ey=(t,e)=>{if(t.length<3||t.length>4)throw new Error("MatMulNBits requires 3 or 4 inputs");let r=t[0],n=r.dims.length;if(r.dims[n-1]!==e.k)throw new Error("The last dim of input shape does not match the k value");let o=Math.floor((e.k+e.blockSize-1)/e.blockSize),i=e.blockSize/8*e.bits,u=t[1];if(!k.areEqual(u.dims,[e.n,o,i]))throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let d=t[2].dims;if(k.size(d)!==e.n*o)throw new Error("scales input size error.");if(t.length===4){let p=t[3].dims,f=e.n*(e.bits===8?o:Math.floor((o*e.bits+7)/8));if(k.size(p)!==f)throw new Error("zeroPoints input size error.")}},ky=(t,e)=>{let r=t[0].dims,n=r.length,o=r[n-2],i=e.k,u=e.n,s=r.slice(0,n-2),d=k.size(s),p=t[1].dims[2]/4,f=t[0].dataType,g=_e(e.k),b=_e(p),y=_e(u),$=s.concat([o,u]),T=o>1&&u/y%2===0?2:1,_=k.size($)/y/T,w=64,S=[],I=[d,o,i/g],C=k.convertShape(t[1].dims).slice();C.splice(-1,1,p/b),S.push(...W(I)),S.push(...W(C)),S.push(...W(t[2].dims)),t.length===4&&S.push(...W(k.convertShape(t[3].dims)));let E=[d,o,u/y];S.push(...W(E));let B=x=>{let U=I.length,N=O("a",t[0].dataType,U,g),F=O("b",12,C.length,b),Z=O("scales",t[2].dataType,t[2].dims.length),ee=[N,F,Z],D=t.length===4?O("zero_points",12,t[3].dims.length):void 0;D&&ee.push(D);let j=E.length,Y=R("output",t[0].dataType,j,y),L=$e(t[0].dataType),J=(()=>{switch(g){case 1:return`array<${L}, 8>`;case 2:return`mat4x2<${L}>`;case 4:return`mat2x4<${L}>`;default:throw new Error(`${g}-component is not supported.`)}})(),le=Math.floor(32/e.bits),ne=Math.floor(le/8),be=()=>{let M="";for(let G=0;G<ne;G++){let he=G*e.bits*4,Ne=he+e.bits;M+=`
          // reuse a data (pass ${G})
            var input_offset${G>0?G:""} = ${G===0?N.indicesToOffset(`${N.type.indices}(batch, row, word_offset)`):"input_offset"};
            var a_data${G>0?G:""}: ${J};
            for (var j${G>0?G:""}: u32 = 0; j${G>0?G:""} < ${8/g}; j${G>0?G:""}++) {
              a_data${G>0?G:""}[j${G>0?G:""}] = ${N.getByOffset(`input_offset${G>0?G:""}`)};
              input_offset${G>0?G:""}++;
            }
          `;for(let Ae=0;Ae<y*T;Ae++)M+=`
            b_value = ${b===1?`b${Ae}_data`:`b${Ae}_data[i]`};
            ${e.bits===2?`{
              let half_word = b_value >> ${G*16}u;
              let byte_lo = half_word & 0xFFu;
              let byte_hi = (half_word >> 8u) & 0xFFu;
              let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
              b_value_lower = unpack4xU8(spread_word & b_mask);
              b_value_upper = unpack4xU8((spread_word >> 2u) & b_mask);
            }`:`b_value_lower = unpack4xU8((b_value >> ${he}u) & b_mask);
            b_value_upper = unpack4xU8((b_value >> ${Ne}u) & b_mask);`}
            b_quantized_values = ${J}(${Array.from({length:4},(ke,Ce)=>`${L}(b_value_lower[${Ce}]), ${L}(b_value_upper[${Ce}])`).join(", ")});
            b_dequantized_values = ${g===1?`${J}(${Array.from({length:8},(ke,Ce)=>`(b_quantized_values[${Ce}] - ${D?`zero_point${Ae}`:"zero_point"}) * scale${Ae}`).join(", ")});`:`(b_quantized_values - ${J}(${Array(8).fill(`${D?`zero_point${Ae}`:"zero_point"}`).join(",")})) * scale${Ae};`};
            workgroup_shared[local_id.x * ${T} + ${Math.floor(Ae/y)}]${y>1?`[${Ae%y}]`:""} += ${Array.from({length:8/g},(ke,Ce)=>`${g===1?`a_data${G>0?G:""}[${Ce}] * b_dequantized_values[${Ce}]`:`dot(a_data${G>0?G:""}[${Ce}], b_dequantized_values[${Ce}])`}`).join(" + ")};
          `}return M},fe=()=>{let M=`
            var col_index = col * ${y};
            ${D?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/e.bits)}u;
            let zero_point_bytes_per_col = (nBlocksPerCol + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is ${Math.pow(2,e.bits-1)} for unsigned ${e.bits}-bit quantization.
            let zero_point = ${L}(${Math.pow(2,e.bits-1).toFixed(1)});`}
            `;for(let G=0;G<y*T;G++)M+=`
            let scale${G} = ${Z.getByOffset("col_index * nBlocksPerCol + block")};
            ${D?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${e.bits}u);
            zero_point_word = ${D.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${G} = ${L}((zero_point_word) & ${e.bits===2?"0x3u":"0xFu"});`:""}
            col_index += 1;`;return M},ue=()=>{let M=`col_index = col * ${y};`;for(let G=0;G<y*T;G++)M+=`
            let b${G}_data = ${F.getByIndices(`${F.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return M+=`
            var b_value: u32;
            let b_mask: u32 = ${e.bits===2?"0x03030303u":"0x0F0F0F0Fu"};
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${J};
            var b_dequantized_values: ${J};`,M};return`
        var<workgroup> workgroup_shared: array<${Y.type.value}, ${T*w}>;
        ${x.declareVariables(...ee,Y)}
        ${x.mainStart([w,1,1])}
          let output_indices = ${Y.offsetToIndices(`(global_idx / ${w}) * ${T}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${w}) {
            //process one block
            var word_offset: u32 = block * ${e.blockSize/g};
            ${fe()}
            for (var word: u32 = 0; word < ${p}; word += ${b}) {
              ${ue()}
              for (var i: u32 = 0; i < ${b}; i++) {
                ${be()}
                word_offset += ${le/g};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${T}) {
            var output_value: ${Y.type.value} = ${Y.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${w}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${T};
            }
            ${Y.setByIndices(`${Y.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${e.blockSize};${e.bits};${g};${b};${y};${T};${w}`,inputDependencies:Array(t.length).fill("rank")},getRunData:()=>({outputs:[{dims:$,dataType:f}],dispatchGroup:{x:_},programUniforms:S}),getShaderSource:B}},Py=(t,e)=>{let r=t[0].dims,n=r.length,o=r[n-2],i=e.k,u=e.n,s=r.slice(0,n-2),d=k.size(s),p=t[1].dims[2]/4,f=t[0].dataType,g=_e(e.k),b=_e(p),y=s.concat([o,u]),$=128,T=u%8===0?8:u%4===0?4:1,_=$/T,w=Math.floor(32/e.bits),S=_*b*w,I=S/g,C=S/e.blockSize,E=k.size(y)/T,B=[],x=[d,o,i/g],U=k.convertShape(t[1].dims).slice();U.splice(-1,1,p/b),B.push(...W(x)),B.push(...W(U)),B.push(...W(t[2].dims)),t.length===4&&B.push(...W(k.convertShape(t[3].dims)));let N=[d,o,u];B.push(...W(N));let F=Z=>{let ee=x.length,D=O("a",t[0].dataType,ee,g),j=O("b",12,U.length,b),Y=O("scales",t[2].dataType,t[2].dims.length),L=[D,j,Y],J=t.length===4?O("zero_points",12,t[3].dims.length):void 0;J&&L.push(J);let le=N.length,ne=R("output",t[0].dataType,le),be=$e(t[0].dataType),fe=()=>{switch(g){case 1:return`
          let a_data0 = vec4<${be}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${be}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${be}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${be}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw new Error(`${g}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${D.type.value}, ${I}>;
        var<workgroup> inter_results: array<array<${ne.type.value}, ${_}>, ${T}>;
        ${Z.declareVariables(...L,ne)}
        ${Z.mainStart([_,T,1])}
          let output_indices = ${ne.offsetToIndices(`workgroup_index * ${T}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${C} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${I};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${I}; a_offset += ${$})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${D.getByIndices(`${D.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${D.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${C} + local_id.x;
            ${J?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/e.bits)}u;
            let zero_point_bytes_per_col = (n_blocks_per_col + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${e.bits}u);
            let zero_point_word = ${J.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${be}((zero_point_word) & ${e.bits===2?"0x3u":"0xFu"});`:`
            // The default zero point is ${Math.pow(2,e.bits-1)} for unsigned ${e.bits}-bit quantization.
            let zero_point = ${be}(${Math.pow(2,e.bits-1).toFixed(1)});`}
            let scale = ${Y.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${j.getByIndices(`${j.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${e.blockSize/g};
            for (var i: u32 = 0; i < ${b}; i++) {
              let b_value = ${b===1?"b_data":"b_data[i]"};
              ${(()=>{let ue=Math.floor(w/8),M="";for(let G=0;G<ue;G++){let he=G*e.bits*4,Ne=he+e.bits;M+=`
              ${fe()}
              {${e.bits===2?`
                let half_word = b_value >> ${G*16}u;
                let byte_lo = half_word & 0xFFu;
                let byte_hi = (half_word >> 8u) & 0xFFu;
                let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
                let b_value_lower = unpack4xU8(spread_word & 0x03030303u);
                let b_value_upper = unpack4xU8((spread_word >> 2u) & 0x03030303u);`:`
                let b_value_lower = unpack4xU8((b_value >> ${he}u) & 0x0F0F0F0Fu);
                let b_value_upper = unpack4xU8((b_value >> ${Ne}u) & 0x0F0F0F0Fu);`}
                let b_quantized_values = mat2x4<${be}>(${Array.from({length:4},(Ae,ke)=>`${be}(b_value_lower[${ke}]), ${be}(b_value_upper[${ke}])`).join(", ")});
                let b_dequantized_values = (b_quantized_values - mat2x4<${be}>(${Array(8).fill("zero_point").join(",")})) * scale;
                inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(Ae,ke)=>`${`dot(a_data${ke}, b_dequantized_values[${ke}])`}`).join(" + ")};
              }
              word_offset += ${8/g};`}return M})()}
            }
            workgroupBarrier();
          }

          if (local_idx < ${T}) {
            var output_value: ${ne.type.value} = ${ne.type.value}(0);
            for (var b = 0u; b < ${_}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${ne.setByIndices(`${ne.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${e.blockSize};${g};${b};${_};${T}`,inputDependencies:Array(t.length).fill("rank")},getRunData:()=>({outputs:[{dims:y,dataType:f}],dispatchGroup:{x:E},programUniforms:B}),getShaderSource:F}},pc=(t,e)=>{Ey(t.inputs,e),e.blockSize===32&&t.adapterInfo.isVendor("intel")&&t.adapterInfo.isArchitecture("gen-12lp")?t.compute(Py(t.inputs,e)):t.compute(ky(t.inputs,e))},mc=t=>Q(t)});var Oy,Dy,By,zy,My,Ry,Uy,Ny,hc,gc=V(()=>{"use strict";X();te();oe();Oy=t=>{if(!t||t.length<1)throw new Error("Too few inputs");if(t[0].dataType!==1&&t[0].dataType!==10)throw new Error("Input type must be float or float16.");if(t.length>=2){let e=t[0].dims.length*2===t[1].dims[0];if(t.length===4&&(e=t[3].dims[0]*2===t[1].dims[0]),!e)throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},Dy=(t,e,r)=>{let n="";for(let o=e-1;o>=0;--o)n+=`
            k = i32(${t.indicesGet("indices",o)}) - ${K("uniforms.pads",o,r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${K("uniforms.x_shape",o,e)})) {
              break;
            }
            offset += k * i32(${K("uniforms.x_strides",o,e)});
        `;return`
          value = ${t.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${n}
            value = x[offset];
          }
      `},By=(t,e,r)=>{let n="";for(let o=e-1;o>=0;--o)n+=`
                k = i32(${t.indicesGet("indices",o)}) - ${K("uniforms.pads",o,r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${K("uniforms.x_shape",o,e)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${K("uniforms.x_shape",o,e)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${K("uniforms.x_strides",o,e)});
            `;return`
              var offset = 0;
              var k = 0;
              ${n}
              value = x[offset];
          `},zy=(t,e,r)=>{let n="";for(let o=e-1;o>=0;--o)n+=`
                k = i32(${t.indicesGet("indices",o)}) - ${K("uniforms.pads",o,r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${K("uniforms.x_shape",o,e)})) {
                  k = i32(${K("uniforms.x_shape",o,e)}) - 1;
                }
                offset += k * i32(${K("uniforms.x_strides",o,e)});
            `;return`
              var offset = 0;
              var k = 0;
              ${n}
              value = x[offset];
          `},My=(t,e,r)=>{let n="";for(let o=e-1;o>=0;--o)n+=`
                k = i32(${t.indicesGet("indices",o)}) - ${K("uniforms.pads",o,r)};
                if (k < 0)  {
                  k += i32(${K("uniforms.x_shape",o,e)}]);
                }
                if (k >= i32(${K("uniforms.x_shape",o,e)})) {
                  k -= i32(${K("uniforms.x_shape",o,e)});
                }
                offset += k * i32(${K("uniforms.x_strides",o,e)});
            `;return`
              var offset = 0;
              var k = 0;
              ${n}
              value = x[offset];
          `},Ry=(t,e,r)=>{switch(r.mode){case 0:return Dy(t,e,r.pads.length);case 1:return By(t,e,r.pads.length);case 2:return zy(t,e,r.pads.length);case 3:return My(t,e,r.pads.length);default:throw new Error("Invalid mode")}},Uy=(t,e)=>{let r=k.padShape(t[0].dims.slice(),e.pads),n=t[0].dims,o=k.size(r),i=[{type:12,data:o},{type:6,data:e.pads}],u=t.length>=3&&t[2].data;e.mode===0&&i.push({type:u?t[2].dataType:1,data:e.value}),i.push(...W(t[0].dims,r));let s=["rank"],d=c=>{let p=R("output",t[0].dataType,r.length),f=O("x",t[0].dataType,n.length),g=f.type.value,b=Ry(p,n.length,e),y=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:e.pads.length}];return e.mode===0&&y.push({name:"constant_value",type:u?g:"f32"}),`
            ${c.registerUniforms(y).declareVariables(f,p)}
            ${c.mainStart()}
            ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${p.offsetToIndices("global_idx")};

            var value = ${g}(0);
            ${b}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${e.mode}${u}`,inputDependencies:s},getRunData:()=>({outputs:[{dims:r,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(k.size(r)/64)},programUniforms:i}),getShaderSource:d}},Ny=(t,e)=>{if(t.length>1){let r=t[1].getBigInt64Array(),n=t.length>=3&&t[2].data?t[2].dataType===10?t[2].getUint16Array()[0]:t[2].getFloat32Array()[0]:0,o=t[0].dims.length,i=new Int32Array(2*o).fill(0);if(t.length>=4){let s=t[3].getBigInt64Array();for(let d=0;d<s.length;d++)i[Number(s[d])]=Number(r[d]),i[Number(s[d])+o]=Number(r[d+s.length])}else r.forEach((s,d)=>i[Number(d)]=Number(s));let u=[];return i.forEach(s=>u.push(s)),{mode:e.mode,value:n,pads:u}}else return e},hc=(t,e)=>{Oy(t.inputs);let r=Ny(t.inputs,e);t.compute(Uy(t.inputs,r),{inputs:[0]})}});var $n,yc,bc,_c,wc,Vy,Ly,vc,$c,xc,Sc,Tc,Ic,Ac,Cc,Ec,kc,Pc,Oc,Dc=V(()=>{"use strict";Ve();X();te();oe();$n=t=>{if(ve.webgpu.validateInputContent&&(!t||t.length!==1))throw new Error("Pool ops requires 1 input.")},yc=(t,e,r)=>{let n=e.format==="NHWC",o=t.dims.slice();n&&o.splice(1,0,o.pop());let i=Object.hasOwnProperty.call(e,"dilations"),u=e.kernelShape.slice(),s=e.strides.slice(),d=i?e.dilations.slice():[],c=e.pads.slice();Rt.adjustPoolAttributes(r,o,u,s,d,c);let p=Rt.computePoolOutputShape(r,o,s,d,u,c,e.autoPad,e.ceilMode),f=Object.assign({},e);i?Object.assign(f,{kernelShape:u,strides:s,pads:c,dilations:d,cacheKey:e.cacheKey}):Object.assign(f,{kernelShape:u,strides:s,pads:c,cacheKey:e.cacheKey});let g=p.slice();return g.push(g.splice(1,1)[0]),[f,n?g:p]},bc=(t,e)=>{let r=e.format==="NHWC",n=k.size(t),o=k.size(e.kernelShape),i=[{type:12,data:n},{type:12,data:o}],u=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(e.kernelShape.length<=2){let s=e.kernelShape[e.kernelShape.length-1],d=e.strides[e.strides.length-1],c=e.pads[e.pads.length/2-1],p=e.pads[e.pads.length-1],f=!!(c+p);i.push({type:12,data:s},{type:12,data:d},{type:12,data:c},{type:12,data:p}),u.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let g=!1;if(e.kernelShape.length===2){let b=e.kernelShape[e.kernelShape.length-2],y=e.strides[e.strides.length-2],$=e.pads[e.pads.length/2-2],T=e.pads[e.pads.length-2];g=!!($+T),i.push({type:12,data:b},{type:12,data:y},{type:12,data:$},{type:12,data:T}),u.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[i,u,!0,f,g]}else{if(r)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let s=k.computeStrides(e.kernelShape);i.push({type:12,data:s},{type:12,data:e.pads},{type:12,data:e.strides}),u.push({name:"kernelStrides",type:"u32",length:s.length},{name:"pads",type:"u32",length:e.pads.length},{name:"strides",type:"u32",length:e.strides.length});let d=e.pads.reduce((c,p)=>c+p);return[i,u,!!d,!1,!1]}},_c=(t,e,r,n,o,i,u,s,d,c,p,f)=>{let g=o.format==="NHWC",b=e.type.value,y=R("output",e.type.tensor,n);if(o.kernelShape.length<=2){let $="",T="",_="",w=r-(g?2:1);if(p?$=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${w}] = indices[${w}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${w}] < 0 || xIndices[${w}]
                      >= uniforms.x_shape[${w}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${e.indicesToOffset("xIndices")}];
                  ${i}
                }`:$=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${w}] = indices[${w}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${e.indicesToOffset("xIndices")}];
                  ${i}
                }`,o.kernelShape.length===2){let I=r-(g?3:2);f?T=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${I}] = indices[${I}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${I}] < 0 || xIndices[${I}] >= uniforms.x_shape[${I}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:T=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${I}] = indices[${I}] * uniforms.sh - uniforms.phStart + j;
                `,_=`
              }
            `}return`
            ${t.registerUniforms(d).declareVariables(e,y)}

            ${t.mainStart()}
              ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${y.offsetToIndices("global_idx")};
              var xIndices = ${y.offsetToIndices("global_idx")};

              var value = ${b}(${s});
              var pad = 0;
              ${T}
              ${$}
              ${_}
              ${u}

              output[global_idx] = value;
            }`}else{if(g)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let $=o.kernelShape.length,T=o.pads.length,_="";return c?_=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${e.indicesToOffset("xIndices")}];
                ${i}
              }`:_=`
              }
              let x_val = x[${e.indicesToOffset("xIndices")}];
              ${i}
            `,`
            ${t.registerUniforms(d).declareVariables(e,y)}

            ${t.mainStart()}
              ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${y.offsetToIndices("global_idx")};
              var xIndices = ${y.offsetToIndices("global_idx")};

              var offsets: array<u32, ${$}>;

              var value = ${b}(${s});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${$-1}u; j++) {
                  offsets[j] = offset / ${K("uniforms.kernelStrides","j",$)};
                  offset -= offsets[j] * ${K("uniforms.kernelStrides","j",$)};
                }
                offsets[${$-1}] = offset;

                isPad = false;
                for (var j = ${r-$}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${K("uniforms.strides",`j - ${r-$}u`,$)}
                    + offsets[j - ${r-$}u] - ${K("uniforms.pads","j - 2u",T)};
                  ${_}
              }
              ${u}

              output[global_idx] = value;
            }`}},wc=t=>`${t.format};${t.ceilMode};${t.autoPad};${t.kernelShape.length}`,Vy=t=>`${wc(t)};${t.countIncludePad}`,Ly=t=>`${wc(t)};${t.storageOrder};${t.dilations}`,vc=t=>({format:t.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][t.auto_pad],ceilMode:t.ceil_mode,kernelShape:t.kernel_shape,strides:t.strides,pads:t.pads}),$c=(t,e,r,n)=>{let[o,i]=yc(e,n,r),u=O("x",e.dataType,e.dims.length),s=u.type.value,d="value += x_val;",c="";o.countIncludePad?c+=`value /= ${s}(uniforms.kernelSize);`:c+=`value /= ${s}(i32(uniforms.kernelSize) - pad);`;let[p,f,g,b,y]=bc(i,o);p.push(...W(e.dims,i));let $=["rank"];return{name:t,shaderCache:{hint:`${n.cacheKey};${g};${b};${y}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:i,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(k.size(i)/64)},programUniforms:p}),getShaderSource:T=>_c(T,u,e.dims.length,i.length,o,d,c,0,f,g,b,y)}},xc=t=>{let e=t.count_include_pad!==0,r=vc(t);if(r.ceilMode!==0)throw new Error("ceil_mode output-shape is computed, but ceil_mode kernel execution (padding/divisor) is not yet implemented in the WebGPU AveragePool kernel");let n={countIncludePad:e,...r,cacheKey:""};return{...n,cacheKey:Vy(n)}},Sc=(t,e)=>{$n(t.inputs),t.compute($c("AveragePool",t.inputs[0],!1,e))},Tc={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},Ic=t=>{let e=t.format;return{format:e,...Tc,cacheKey:e}},Ac=(t,e)=>{$n(t.inputs),t.compute($c("GlobalAveragePool",t.inputs[0],!0,e))},Cc=(t,e,r,n)=>{let[o,i]=yc(e,n,r),u=`
      value = max(x_val, value);
    `,s="",d=O("x",e.dataType,e.dims.length),c=["rank"],[p,f,g,b,y]=bc(i,o);return p.push(...W(e.dims,i)),{name:t,shaderCache:{hint:`${n.cacheKey};${g};${b};${y}`,inputDependencies:c},getRunData:()=>({outputs:[{dims:i,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(k.size(i)/64)},programUniforms:p}),getShaderSource:$=>_c($,d,e.dims.length,i.length,o,u,s,e.dataType===10?-65504:-1e5,f,g,b,y)}},Ec=(t,e)=>{$n(t.inputs),t.compute(Cc("MaxPool",t.inputs[0],!1,e))},kc=t=>{let e=t.storage_order,r=t.dilations,n=vc(t);if(e!==0)throw new Error("column major storage order is not yet supported for MaxPool");if(n.ceilMode!==0)throw new Error("ceil_mode output-shape is computed, but ceil_mode kernel execution (padding) is not yet implemented in the WebGPU MaxPool kernel");let o={storageOrder:e,dilations:r,...n,cacheKey:""};return{...o,cacheKey:Ly(o)}},Pc=t=>{let e=t.format;return{format:e,...Tc,cacheKey:e}},Oc=(t,e)=>{$n(t.inputs),t.compute(Cc("GlobalMaxPool",t.inputs[0],!0,e))}});var Gy,Hy,Bc,zc,Mc=V(()=>{"use strict";X();te();Ie();oe();Gy=(t,e)=>{if(t.length<2||t.length>3)throw new Error("DequantizeLinear requires 2 or 3 inputs.");if(t.length===3&&t[1].dims===t[2].dims)throw new Error("x-scale and x-zero-point must have the same shape.");if(t.length===3&&t[0].dataType!==t[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(t[1].dims.length!==0&&t[1].dims.length!==1&&t[1].dims.length!==t[0].dims.length)throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(t.length>2){if(t[0].dataType!==t[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(t[1].dims.length!==t[2].dims.length)throw new Error("scale and zero-point inputs must have the same rank.");if(!t[1].dims.map((r,n)=>r===t[2].dims[n]).reduce((r,n)=>r&&n,!0))throw new Error("scale and zero-point inputs must have the same shape.")}if(e.blockSize>0){if(t[1].dims.length===0||t[1].dims.length===1&&t[1].dims[0]===1)throw new Error("blockSize must be set only for block quantization.");if(!t[1].dims.map((o,i)=>i===e.axis||o===t[0].dims[i]).reduce((o,i)=>o&&i,!0))throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");if(t[1].dims.length!==t[0].dims.length)throw new Error("For block qunatization the scale input rank must be the same as the x rank.");let r=t[0].dims[e.axis],n=t[1].dims[e.axis];if(e.blockSize<Math.ceil(r/n)||e.blockSize>Math.ceil(r/(n-1)-1))throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},Hy=(t,e)=>{let r=k.normalizeAxis(e.axis,t[0].dims.length),n=t[0].dataType,o=n===3,i=t[0].dims,u=t[1].dataType,s=k.size(i),d=n===3||n===2,c=d?[Math.ceil(k.size(t[0].dims)/4)]:t[0].dims,p=t[1].dims,f=t.length>2?t[2]:void 0,g=f?d?[Math.ceil(k.size(f.dims)/4)]:f.dims:void 0,b=p.length===0||p.length===1&&p[0]===1,y=b===!1&&p.length===1,$=_e(s),T=b&&(!d||$===4),_=T?$:1,w=T&&!d?$:1,S=O("input",d?12:n,c.length,w),I=O("scale",u,p.length),C=f?O("zero_point",d?12:n,g.length):void 0,E=R("output",u,i.length,_),B=[S,I];C&&B.push(C);let x=[c,p];f&&x.push(g);let U=[{type:12,data:s/_},{type:12,data:r},{type:12,data:e.blockSize},...W(...x,i)],N=F=>{let Z=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${F.registerUniforms(Z).declareVariables(...B,E)}
      ${F.mainStart()}
          ${F.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${E.offsetToIndices("global_idx")};

          // Set input x
          ${d?`
            let input = ${S.getByOffset("global_idx / 4")};
            let x_vec = ${o?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${_===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${S.getByOffset("global_idx")};`};

          // Set scale input
          ${b?`let scale_value= ${I.getByOffset("0")}`:y?`
            let scale_index = ${E.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${I.getByOffset("scale_index")};`:`
            var scale_indices: ${I.type.indices} = output_indices;
            let index = ${I.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${I.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${I.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${C?b?d?`
                let zero_point_input = ${C.getByOffset("0")};
                let zero_point_vec =  ${o?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${C.getByOffset("0")}`:y?d?`
                let zero_point_index = ${E.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${C.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${o?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${E.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${C.getByOffset("zero_point_index")};`:d?`
                let zero_point_offset = ${I.indicesToOffset("scale_indices")};
                let zero_point_input = ${C.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${o?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${C.getByIndices("scale_indices")};`:`let zero_point_value = ${d?o?"i32":"u32":S.type.value}(0);`};
      // Compute and write output
      ${E.setByOffset("global_idx",`${E.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:e.cacheKey,inputDependencies:C?["rank","rank","rank"]:["rank","rank"]},getShaderSource:N,getRunData:()=>({outputs:[{dims:i,dataType:u}],dispatchGroup:{x:Math.ceil(s/_/64),y:1,z:1},programUniforms:U})}},Bc=(t,e)=>{Gy(t.inputs,e),t.compute(Hy(t.inputs,e))},zc=t=>Q({axis:t.axis,blockSize:t.blockSize})});var Fy,qy,Rc,Uc=V(()=>{"use strict";Ve();X();oe();Fy=(t,e,r)=>{let n=t===e,o=t<e&&r<0,i=t>e&&r>0;if(n||o||i)throw new Error("Range these inputs' contents are invalid.")},qy=(t,e,r,n)=>{let o=Math.abs(Math.ceil((e-t)/r)),i=[o],u=o,s=[{type:12,data:u},{type:n,data:t},{type:n,data:r},...W(i)],d=c=>{let p=R("output",n,i.length),f=p.type.value,g=[{name:"outputSize",type:"u32"},{name:"start",type:f},{name:"delta",type:f}];return`
        ${c.registerUniforms(g).declareVariables(p)}
        ${c.mainStart()}
        ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${f}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${n}`},getShaderSource:d,getRunData:()=>({outputs:[{dims:i,dataType:n}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:s})}},Rc=t=>{let e=0,r=0,n=0;t.inputs[0].dataType===6?(e=t.inputs[0].getInt32Array()[0],r=t.inputs[1].getInt32Array()[0],n=t.inputs[2].getInt32Array()[0]):t.inputs[0].dataType===1&&(e=t.inputs[0].getFloat32Array()[0],r=t.inputs[1].getFloat32Array()[0],n=t.inputs[2].getFloat32Array()[0]),ve.webgpu.validateInputContent&&Fy(e,r,n),t.compute(qy(e,r,n,t.inputs[0].dataType),{inputs:[]})}});var Ky,jy,Nc,Vc,Lc=V(()=>{"use strict";X();te();Ie();oe();Ky=(t,e,r,n)=>{if(t!=="none"&&n!=="i32"&&n!=="u32"&&n!=="f32")throw new Error(`Input ${n} is not supported with reduction ${t}.`);let o=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,i=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${e}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(t){case"none":return`${e}=${r};`;case"add":return n==="i32"||n==="u32"?`atomicAdd(&${e}, bitcast<${n}>(${r}));`:`
              ${o}bitcast<${n}>(oldValue) + (${r})${i}`;case"max":return n==="i32"||n==="u32"?`atomicMax(&${e}, bitcast<${n}>(${r}));`:`
                ${o}max(bitcast<f32>(oldValue), (${r}))${i}`;case"min":return n==="i32"||n==="u32"?`atomicMin(&${e}, bitcast<${n}>(${r}));`:`${o}min(bitcast<${n}>(oldValue), (${r}))${i}`;case"mul":return`${o}(bitcast<${n}>(oldValue) * (${r}))${i}`;default:throw new Error(`Reduction ${t} is not supported.`)}},jy=(t,e)=>{let r=t[0].dims,n=t[1].dims,o=r,i=1,u=Math.ceil(k.sizeToDimension(n,n.length-1)/i),s=n[n.length-1],d=k.sizeFromDimension(r,s),c=[{type:12,data:u},{type:12,data:s},{type:12,data:d},...W(t[1].dims,t[2].dims,o)],p=f=>{let g=O("indices",t[1].dataType,t[1].dims.length),b=O("updates",t[2].dataType,t[2].dims.length,i),y=e.reduction!=="none"&&e.reduction!==""?ou("output",t[0].dataType,o.length):R("output",t[0].dataType,o.length,i);return`
      ${f.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(g,b,y)}
      ${f.mainStart()}
        ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${t[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${Ky(e.reduction,"output[data_offset + i]","value",y.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${e.cacheKey}_${e.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:o,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:c}),getShaderSource:p}},Nc=t=>Q({reduction:t.reduction}),Vc=(t,e)=>{t.compute(jy(t.inputs,e),{inputs:[t.inputs[1],t.inputs[2]],outputs:[]})}});var Zy,Qy,Yy,Wc,Xy,Jy,eb,tb,rb,nb,ob,ib,Gc,ab,sb,ub,db,lb,Hc,Fc,qc=V(()=>{"use strict";X();te();Ie();oe();Zy=(t,e)=>{if(t.every(r=>r>0||(()=>{throw new Error("Resize requires scales input values to be positive")})),t.length>0){if(e.mode==="linear"){if(!(t.length===2||t.length===3||t.length===4&&t[0]===1&&t[1]===1||t.length===4&&t[0]===1&&t[3]===1||t.length===5&&t[0]===1&&t[1]===1))throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(e.mode==="cubic"&&!(t.length===2||t.length===4&&t[0]===1&&t[1]===1||t.length===4&&t[0]===1&&t[3]===1))throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},Qy=(t,e,r)=>{e.every(o=>o>=0&&o<r||(()=>{throw new Error("Resize requires axes input values to be positive and less than rank")}));let n=new Array(r).fill(1);return e.forEach((o,i)=>n[o]=t[i]),n},Yy=(t,e,r,n,o,i)=>{let[u,s,d]=r>10?[1,2,3]:[-1,t.length>1?1:-1,-1],c=t[0].dims.length;if(u>0&&t.length>u&&t[u].dims.length>0)t[u].getFloat32Array().forEach(p=>i.push(p));else if(e.coordinateTransformMode==="tf_crop_and_resize")throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(s>0&&t.length>s&&t[s].dims.length===1&&t[s].dims[0]>0){if(t[s].getFloat32Array().forEach(p=>n.push(p)),n.length!==0&&n.length!==c&&r>=18&&n.length!==e.axes.length)throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");Zy(n,e),e.axes.length>0&&Qy(n,e.axes,c).forEach((p,f)=>n[f]=p)}if(d>0&&t.length>d&&t[d].dims.length===1&&t[d].dims[0]>0&&(t[d].getBigInt64Array().forEach(p=>o.push(Number(p))),o.length!==0&&o.length!==c&&r>=18&&o.length!==e.axes.length))throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(e.axes.length>0){if(n.length!==0&&n.length!==e.axes.length)throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(o.length!==0&&o.length!==e.axes.length)throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof n<"u"&&typeof o<"u"&&n.length>0&&o.length>c)throw new Error("Resize requires only of scales or sizes to be specified")},Wc=(t,e,r,n)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${t}) * (${e});
  let whole = ${n}(big / (${r}));
  let fract = ${n}(big % (${r})) / ${n}(${r});
  return whole + fract;
`,Xy=(t,e)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${e} { `+(()=>{switch(t){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${e}(xResized) / ${e}(xScale);
          } else {
            ${Wc("xResized","lengthOriginal","lengthResized",e)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${e}(xResized) + 0.5) / ${e}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${e}(xResized) + 0.5) / ${e}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${Wc("xResized","lengthOriginal - 1","lengthResized - 1",e)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${e}(roiStart) * ${e}(lengthOriginal - 1) +
                        (${e}(xResized) * ${e}(roiEnd - roiStart) * ${e}(lengthOriginal - 1)) /
                        ${e}(lengthResized - 1);
                  } else {
                    return 0.5 * ${e}(roiStart + roiEnd) * ${e}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${e}xScale * ${e}(lengthResized);
                  const adjustment = ${e}(lengthResized) / outputWidth;
                  const center = ${e}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${e}(xResized) + 0.5) / ${e}(xScale)) - 0.5;`;case"half_pixel":return`return ((${e}(xResized) + 0.5) / ${e}(xScale)) - 0.5;`;default:throw new Error(`Coordinate transform mode ${t} is not supported`)}})()+"}",Jy=(t,e,r)=>`fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {`+(()=>{switch(t){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";default:if(e<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw new Error(`Nearest mode ${t} is not supported`)}})()+"}",eb=(t,e,r)=>{let n=new Array(r).fill(0).concat(new Array(r).fill(1)),o=t.length===0?n:t.slice();return e.length>0?(e.forEach((i,u)=>{n[i]=o[u],n[u+r]=o[e.length+u]}),n):o},tb=(t,e,r,n)=>{let o=[];if(r.length>0)if(n.length>0){if(t.forEach(i=>o.push(i)),Math.max(...n)>t.length)throw new Error("axes is out of bound");n.forEach((i,u)=>o[i]=r[u])}else r.forEach(i=>o.push(i));else{if(e.length===0)throw new Error("Resize requires either scales or sizes.");o=t.map((i,u)=>Math.round(i*e[u]))}return o},rb=(t,e,r)=>{let n=(()=>{switch(r.keepAspectRatioPolicy){case"not_larger":return r.axes.length>0?Math.min(...r.axes.map(i=>e[i]),Number.MAX_VALUE):Math.min(...e,Number.MAX_VALUE);case"not_smaller":return r.axes.length>0?Math.max(...r.axes.map(i=>e[i]),Number.MIN_VALUE):Math.max(...e,Number.MIN_VALUE);default:throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`)}})();e.fill(1,0,e.length);let o=t.slice();return r.axes.length>0?(r.axes.forEach(i=>e[i]=n),r.axes.forEach(i=>o[i]=Math.round(t[i]*e[i]))):(e.fill(n,0,e.length),o.forEach((i,u)=>o[u]=Math.round(i*e[u]))),o},nb=(t,e,r,n,o)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> array<${t.type.value}, ${r.length}> {
      var original_indices: array<${t.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${t.indicesGet("output_indices","i")};
        var scale = ${K("uniforms.scales","i",n)};
        var roi_low = ${K("uniforms.roi","i",o)};
        var roi_hi = ${K("uniforms.roi",`i + ${e.length}`,o)};
        if (scale == 1.0) {
          original_indices[i] = ${t.type.value}(output_index);
        } else {
          var input_shape_i = ${K("uniforms.input_shape","i",e.length)};
          var output_shape_i = ${K("uniforms.output_shape","i",r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,ob=(t,e,r,n,o,i,u)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> ${t.type.indices} {
      var input_indices: ${t.type.indices};
      for (var i:u32 = 0; i < ${n.length}; i++) {
        var output_index = ${e.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${K("uniforms.scales","i",o)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${K("uniforms.roi","i",i)};
          var roi_hi = ${K("uniforms.roi",`i + ${r.length}`,i)};
          var input_shape_i = ${K("uniforms.input_shape","i",r.length)};
          var output_shape_i = ${K("uniforms.output_shape","i",n.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${u} || (original_idx >= 0 && original_idx < ${e.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${e.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${t.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,ib=(t,e)=>`
    fn checkInputIndices(input_indices: ${t.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${e.length}; i++) {
        var input_index = ${t.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${K("uniforms.input_shape","i",e.length)}) {
          return false;
        }
      }
      return true;
    }`,Gc=(t,e,r,n)=>t.rank>n?`
    ${t.indicesSet("input_indices",e,"channel")};
    ${t.indicesSet("input_indices",r,"batch")};
`:"",ab=(t,e,r,n,o)=>{let[u,s,d,c]=r.length===2?[-1,0,1,-1]:[0,2,3,1],p=t.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${p} {
      var input_indices: ${t.type.indices};
      ${t.indicesSet("input_indices",s,`max(0, min(row, ${r[s]} - 1))`)};
      ${t.indicesSet("input_indices",d,`max(0, min(col, ${r[d]} - 1))`)};
      ${Gc(t,c,u,2)}
      return ${t.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${e.type.indices}) -> ${p} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${p} = originalIndices[${s}];
      var col:${p} = originalIndices[${d}];
      ${n?`if (row < 0 || row > (${r[s]} - 1) || col < 0 || col > (${r[d]} - 1)) {
        return ${o};
      }`:""};
      row = max(0, min(row, ${r[s]} - 1));
      col = max(0, min(col, ${r[d]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length>2?`u32(originalIndices[${c}])`:"0"};
      var batch: u32 =  ${r.length>2?`u32(originalIndices[${u}])`:"0"};
      var x11: ${p} = getInputValue(batch, channel, row1, col1);
      var x12: ${p} = getInputValue(batch, channel, row1, col2);
      var x21: ${p} = getInputValue(batch, channel, row2, col1);
      var x22: ${p} = getInputValue(batch, channel, row2, col2);
      var dx1: ${p} = abs(row - ${p}(row1));
      var dx2: ${p} = abs(${p}(row2) - row);
      var dy1: ${p} = abs(col - ${p}(col1));
      var dy2: ${p} = abs(${p}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},sb=(t,e,r,n,o,i,u,s,d,c)=>{let p=r.length===2,f=!0,[g,b]=p?[0,1]:f?[2,3]:[1,2],y=t.type.value,$=T=>{let _=T===g?"row":"col";return`
      fn ${_}CubicInterpolation(input_indices: ${t.type.indices}, output_indices: ${e.type.indices}) -> ${y} {
        var output_index = ${e.indicesGet("output_indices",T)};
        var originalIdx: ${y} = getOriginalCoordinateFromResizedCoordinate(output_index, ${o[T]},
        ${n[T]}, ${r[T]}, ${i[T]}, ${i[T]} + ${r.length});
        var fractOriginalIdx: ${y} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${s} && (originalIdx < 0 || originalIdx > (${r[T]} - 1))) {
          return ${d};
        }
        var data: array<${y}, 4> = array<${y}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${_}: ${y} = originalIdx + ${y}(i);
          if (${_} < 0 || ${_} >= ${r[T]}) {
            ${c?`coefs[i + 1] = 0.0;
                        continue;`:s?`return ${d};`:`${_} = max(0, min(${_}, ${r[T]} - 1));`};
          }
        var input_indices_copy: ${t.type.indices} = input_indices;
          ${t.indicesSet("input_indices_copy",T,`u32(${_})`)};
          data[i + 1] = ${T===g?t.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${$(g)};
    ${$(b)};
  fn getCubicInterpolationCoefs(s: ${y}) -> array<${y}, 4> {
    var absS = abs(s);
    var coeffs: array<${y}, 4> = array<${y}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${y} = 1.0 - absS;
    var twoMinusAbsS: ${y} = 2.0 - absS;
    var onePlusAbsS: ${y} = 1.0 + absS;
    coeffs[0] = ((${u} * onePlusAbsS - 5 * ${u}) * onePlusAbsS + 8 * ${u}) * onePlusAbsS - 4 * ${u};
    coeffs[1] = ((${u} + 2) * absS - (${u} + 3)) * absS * absS + 1;
    coeffs[2] = ((${u} + 2) * oneMinusAbsS - (${u} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${u} * twoMinusAbsS - 5 * ${u}) * twoMinusAbsS + 8 * ${u}) * twoMinusAbsS - 4 * ${u};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${y}, 4>, coefs: array<${y}, 4>) -> ${y} {
    var coefsSum: ${y} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${e.type.indices}) -> ${y} {
    var input_indices: ${t.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},ub=(t,e,r,n,o)=>{let[u,s,d,c,p]=r.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],f=t.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${f} {
      var input_indices: ${t.type.indices};
      ${t.indicesSet("input_indices",s,`max(0, min(depth, ${r[s]} - 1))`)};
      ${t.indicesSet("input_indices",d,`max(0, min(height, ${r[d]} - 1))`)};
      ${t.indicesSet("input_indices",c,`max(0, min(width, ${r[c]} - 1))`)};
      ${Gc(t,p,u,3)}
      return ${t.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${e.type.indices}) -> ${f} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${f} = originalIndices[${s}];
      var height:${f} = originalIndices[${d}];
      var width:${f} = originalIndices[${c}];
      ${n?`if (depth < 0 || depth > (${r[s]} - 1) || height < 0 || height > (${r[d]} - 1) || width < 0 || (width > ${r[c]} - 1)) {
      return ${o};
        }`:""};

    depth = max(0, min(depth, ${r[s]} - 1));
      height = max(0, min(height, ${r[d]} - 1));
      width = max(0, min(width, ${r[c]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length>3?`u32(originalIndices[${p}])`:"0"};
      var batch: u32 =  ${r.length>3?`u32(originalIndices[${u}])`:"0"};

      var x111: ${f} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${f} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${f} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${f} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${f} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${f} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${f} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${f} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${f} = abs(depth - ${f}(depth1));
      var dx2: ${f} = abs(${f}(depth2) - depth);
      var dy1: ${f} = abs(height - ${f}(height1));
      var dy2: ${f} = abs(${f}(height2) - height);
      var dz1: ${f} = abs(width - ${f}(width1));
      var dz2: ${f} = abs(${f}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},db=(t,e,r,n,o,i)=>{let u=t.dims,s=eb(i,e.axes,u.length),d=tb(u,n,o,e.axes),c=n.slice();n.length===0&&(c=u.map((w,S)=>w===0?1:d[S]/w),e.keepAspectRatioPolicy!=="stretch"&&(d=rb(u,c,e)));let p=R("output",t.dataType,d.length),f=O("input",t.dataType,u.length),g=k.size(d),b=u.length===d.length&&u.every((w,S)=>w===d[S]),y=e.coordinateTransformMode==="tf_crop_and_resize",$=e.extrapolationValue,T=f.type.value,_=w=>`
      ${b?"":`
      ${Xy(e.coordinateTransformMode,T)};
      ${(()=>{switch(e.mode){case"nearest":return`
              ${ib(f,u)};
              ${Jy(e.nearestMode,r,T)};
              ${ob(f,p,u,d,c.length,s.length,y)};
              `;case"linear":return`
              ${nb(p,u,d,c.length,s.length)};
              ${(()=>{if(u.length===2||u.length===4)return`${ab(f,p,u,y,$)}`;if(u.length===3||u.length===5)return`${ub(f,p,u,y,$)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(u.length===2||u.length===4)return`${sb(f,p,u,d,c,s,e.cubicCoeffA,y,e.extrapolationValue,e.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${w.registerUniform("output_size","u32").registerUniform("scales","f32",c.length).registerUniform("roi","f32",s.length).declareVariables(f,p)}
      ${w.mainStart()}
        ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${b?"output[global_idx] = input[global_idx];":`
        let output_indices = ${p.offsetToIndices("global_idx")};
        var input_indices: ${f.type.indices};
        ${(()=>{switch(e.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${f.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${e.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${u.length===2||u.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${e.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${e.cacheKey}|${r}|${c.length>0?e.mode==="cubic"?c:c.length:""}|${o.length>0?o:""}|${s.length>0?s:""}|${b}|${e.mode==="nearest"?u.length:u}`,inputDependencies:["rank"]},getShaderSource:_,getRunData:()=>({outputs:[{dims:d,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:[{type:12,data:g},{type:1,data:c},{type:1,data:s},...W(u,d)]})}},lb=t=>{let e=t.customDataBuffer;return new Uint32Array(e.buffer,e.byteOffset,1)[0]},Hc=(t,e)=>{let r=[],n=[],o=[],i=lb(t);if(e.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");Yy(t.inputs,e,i,r,n,o),t.compute(db(t.inputs[0],e,i,r,n,o),{inputs:[0]})},Fc=t=>{let e=t.antialias,r=t.axes,n=t.coordinateTransformMode,o=t.cubicCoeffA,i=t.excludeOutside!==0,u=t.extrapolationValue,s=t.keepAspectRatioPolicy,d=t.mode,c=t.nearestMode===""?"simple":t.nearestMode;return Q({antialias:e,axes:r,coordinateTransformMode:n,cubicCoeffA:o,excludeOutside:i,extrapolationValue:u,keepAspectRatioPolicy:s,mode:d,nearestMode:c})}});var cb,pb,Kc,jc=V(()=>{"use strict";X();te();oe();cb=t=>{if(!t||t.length<3)throw new Error("layerNorm requires at least 3 inputs.");let e=t[0],r=t[1],n=t[2];if(e.dataType!==r.dataType||e.dataType!==n.dataType)throw new Error("All inputs must have the same data type");if(e.dims.length!==3&&e.dims.length!==2)throw new Error("Input must be 2D or 3D");if(r.dims.length!==3&&r.dims.length!==2)throw new Error("Skip must be 2D or 3D");let o=e.dims[e.dims.length-1],i=e.dims[e.dims.length-2];if(r.dims[r.dims.length-1]!==o)throw new Error("Skip must have the same hidden size as input");if(r.dims[r.dims.length-2]!==i)throw new Error("Skip must have the same sequence length as input");if(n.dims.length!==1)throw new Error("Gamma must be 1D");if(n.dims[n.dims.length-1]!==o)throw new Error("Gamma must have the same hidden size as input");if(t.length>3){let u=t[3];if(u.dims.length!==1)throw new Error("Beta must be 1D");if(u.dims[u.dims.length-1]!==o)throw new Error("Beta must have the same hidden size as input")}if(t.length>4){let u=t[4];if(u.dims.length!==1)throw new Error("Bias must be 1D");if(u.dims[u.dims.length-1]!==o)throw new Error("Bias must have the same hidden size as input")}},pb=(t,e,r,n)=>{let o=e.simplified,i=t[0].dims,u=k.size(i),s=i,d=u,c=i.slice(-1)[0],p=n?i.slice(0,-1).concat(1):[],f=!o&&t.length>3,g=t.length>4,b=n&&r>1,y=n&&r>2,$=r>3,T=64,_=_e(c),w=[{type:12,data:d},{type:12,data:_},{type:12,data:c},{type:1,data:e.epsilon}],S=C=>{let E=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],B=[O("x",t[0].dataType,t[0].dims,_),O("skip",t[1].dataType,t[1].dims,_),O("gamma",t[2].dataType,t[2].dims,_)];f&&B.push(O("beta",t[3].dataType,t[3].dims,_)),g&&B.push(O("bias",t[4].dataType,t[4].dims,_)),B.push(R("output",t[0].dataType,s,_)),b&&B.push(R("mean_output",1,p)),y&&B.push(R("inv_std_output",1,p)),$&&B.push(R("input_skip_bias_sum",t[0].dataType,s,_));let x=$e(t[0].dataType),U=$e(1,_);return`

      ${C.registerUniforms(E).declareVariables(...B)}
      var<workgroup> sum_shared : array<${U}, ${T}>;
      var<workgroup> sum_squared_shared : array<${U}, ${T}>;

      ${C.mainStart([T,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${T};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${T};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${T-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${g?"bias[offset1d + i]":x+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${$?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${Nt(x,_,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${T};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${Ze("sum",_)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${Ze("square_sum",_)} / f32(uniforms.hidden_size) ${o?"":"- mean * mean"} + uniforms.epsilon);
        ${b?"mean_output[global_idx] = mean;":""}
        ${y?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${o?"":`- ${x}(mean)`}) *
            ${x}(inv_std_dev) * gamma[offset1d + i]
            ${f?"+ beta[offset1d + i]":""};
        }
      }`},I=[{dims:s,dataType:t[0].dataType}];return r>1&&I.push({dims:p,dataType:1}),r>2&&I.push({dims:p,dataType:1}),r>3&&I.push({dims:i,dataType:t[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${_};${b};${y};${$}`,inputDependencies:t.map((C,E)=>"type")},getShaderSource:S,getRunData:()=>({outputs:I,dispatchGroup:{x:Math.ceil(d/c)},programUniforms:w})}},Kc=(t,e)=>{cb(t.inputs);let n=[0];t.outputCount>1&&n.push(-3),t.outputCount>2&&n.push(-3),t.outputCount>3&&n.push(3),t.compute(pb(t.inputs,e,t.outputCount,!1),{outputs:n})}});var mb,xn,fb,Zc,hb,gb,Qc,Yc,Xc=V(()=>{"use strict";X();te();Ie();oe();mb=(t,e)=>{if(!t||t.length<1)throw new Error("too few inputs");if(e.axes.length!==0){if(e.axes.length!==e.starts.length||e.axes.length!==e.ends.length)throw new Error("axes, starts and ends must have the same length")}else if(e.starts.length!==e.ends.length)throw new Error("starts and ends must have the same length");t.slice(1).forEach((r,n)=>{if(t[n+1].dataType!==6&&t[n+1].dataType!==7)throw new Error(`Input ${n} must be an array of int32 or int64`)})},xn=(t,e)=>{let r=[];if(t.length>e)if(t[e].dataType===7)t[e].getBigInt64Array().forEach(n=>r.push(Number(n)));else if(t[e].dataType===6)t[e].getInt32Array().forEach(n=>r.push(Number(n)));else throw new Error(`Input ${e} must be an array of int32 or int64`);return r},fb=(t,e)=>{if(t.length>1){let r=xn(t,1),n=xn(t,2),o=xn(t,3);return o.length===0&&(o=[...Array(t[0].dims.length).keys()]),Q({starts:r,ends:n,axes:o})}else return e},Zc=(t,e,r,n,o)=>{let i=t;return t<0&&(i+=r[n[e]]),o[e]<0?Math.max(0,Math.min(i,r[n[e]]-1)):Math.max(0,Math.min(i,r[n[e]]))},hb=(t,e,r)=>`fn calculateInputIndices(output_indices: ${e.type.indices}) -> ${t.type.indices} {
          var input_indices: ${t.type.indices};
          var carry = 0u;
          for (var i = ${r.length-1}; i >= 0; i--) {
            let input_shape_i = ${K("uniforms.input_shape","i",r.length)};
            let steps_i = ${K("uniforms.steps","i",r.length)};
            let signs_i = ${K("uniforms.signs","i",r.length)};
            let starts_i = ${K("uniforms.starts","i",r.length)};
            var output_index = ${e.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${t.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,gb=(t,e)=>{let r=t[0].dims,n=k.size(r),o=e.axes.length>0?k.normalizeAxes(e.axes,r.length):[...Array(r.length).keys()],i=xn(t,4);i.forEach(_=>_!==0||(()=>{throw new Error("step cannot be 0")})),i.length===0&&(i=Array(o.length).fill(1));let u=e.starts.map((_,w)=>Zc(_,w,r,o,i)),s=e.ends.map((_,w)=>Zc(_,w,r,o,i));if(o.length!==u.length||o.length!==s.length)throw new Error("start, ends and axes should have the same number of elements");if(o.length!==r.length)for(let _=0;_<r.length;++_)o.includes(_)||(u.splice(_,0,0),s.splice(_,0,r[_]),i.splice(_,0,1));let d=i.map(_=>Math.sign(_));i.forEach((_,w,S)=>{if(_<0){let I=(s[w]-u[w])/_,C=u[w],E=C+I*i[w];u[w]=E,s[w]=C,S[w]=-_}});let c=r.slice(0);o.forEach((_,w)=>{c[_]=Math.ceil((s[_]-u[_])/i[_])});let p={dims:c,dataType:t[0].dataType},f=R("output",t[0].dataType,c.length),g=O("input",t[0].dataType,t[0].dims.length),b=k.size(c),y=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:u.length},{name:"signs",type:"i32",length:d.length},{name:"steps",type:"u32",length:i.length}],$=[{type:12,data:b},{type:12,data:u},{type:6,data:d},{type:12,data:i},...W(t[0].dims,c)],T=_=>`
      ${_.registerUniforms(y).declareVariables(g,f)}
        ${hb(g,f,r)}
        ${_.mainStart()}
          ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${f.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${f.setByOffset("global_idx",g.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${d.length}_${u.length}_${i.length}`,inputDependencies:["rank"]},getShaderSource:T,getRunData:()=>({outputs:[p],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:$})}},Qc=(t,e)=>{mb(t.inputs,e);let r=fb(t.inputs,e);t.compute(gb(t.inputs,r),{inputs:[0]})},Yc=t=>{let e=t.starts,r=t.ends,n=t.axes;return Q({starts:e,ends:r,axes:n})}});var yb,bb,Jc,ep,tp=V(()=>{"use strict";X();te();Ie();pt();oe();yb=t=>{if(!t||t.length!==1)throw new Error("Softmax op requires 1 input.")},bb=(t,e)=>{let r=t.inputs[0],n=r.dims,o=k.size(n),i=n.length,u=k.normalizeAxis(e.axis,i),s=u<n.length-1,d,c=[];s?(c=Array.from({length:i},(B,x)=>x),c[u]=i-1,c[i-1]=u,d=t.compute(ze(r,c),{inputs:[r],outputs:[-1]})[0]):d=r;let p=d.dims,f=p[i-1],g=o/f,b=_e(f),y=f/b,$=64;g===1&&($=256);let T=(B,x)=>x===4?`max(max(${B}.x, ${B}.y), max(${B}.z, ${B}.w))`:x===2?`max(${B}.x, ${B}.y)`:x===3?`max(max(${B}.x, ${B}.y), ${B}.z)`:B,_=O("x",d.dataType,d.dims,b),w=R("result",d.dataType,d.dims,b),S=_.type.value,I=$e(d.dataType)==="f32"?`var threadMax = ${S}(-3.4028234663852886e+38f);`:`var threadMax = ${S}(-65504.0h);`,C=B=>`
      var<workgroup> rowMaxShared : ${S};
      var<workgroup> rowSumShared : ${S};
      var<workgroup> threadShared : array<${S}, ${$}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${S} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${S}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${B.registerUniform("packedCols","i32").declareVariables(_,w)}
      ${B.mainStart($)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${$};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${I}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${S}(${T("threadShared[0]",b)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${S}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${S}(${Ze("threadShared[0]",b)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${S}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`,E=t.compute({name:"Softmax",shaderCache:{hint:`${b};${$}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:p,dataType:d.dataType}],dispatchGroup:{x:g},programUniforms:[{type:6,data:y}]}),getShaderSource:C},{inputs:[d],outputs:[s?-1:0]})[0];s&&t.compute(ze(E,c),{inputs:[E]})},Jc=(t,e)=>{yb(t.inputs),bb(t,e)},ep=t=>Q({axis:t.axis})});var rp,_b,wb,vb,np,op=V(()=>{"use strict";X();te();oe();rp=t=>Array.from(t.getBigInt64Array(),Number),_b=t=>{if(!t||t.length!==2)throw new Error("Tile requires 2 inputs.");if(t[0].dataType!==1&&t[0].dataType!==10&&t[0].dataType!==6&&t[0].dataType!==12)throw new Error("Tile only support float, float16, int32, and uint32 data types");if(t[1].dataType!==7)throw new Error("Tile `repeats` input should be of int64 data type");if(t[1].dims.length!==1)throw new Error("Tile `repeats` input should be 1-D");if(rp(t[1]).length!==t[0].dims.length)throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},wb=(t,e)=>{let r=[];for(let n=0;n<t.length;++n)r.push(t[n]*e[n]);return r},vb=(t,e)=>{let r=t[0].dims,n=e??rp(t[1]),o=wb(r,n),i=k.size(o),u=t[0].dataType,s=O("input",u,r.length),d=R("output",u,o.length),c=p=>`
      const inputShape = ${s.indices(...r)};
      ${p.registerUniform("output_size","u32").declareVariables(s,d)}
      ${p.mainStart()}
      ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${d.offsetToIndices("global_idx")};
      var input_indices: ${s.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${s.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${d.indicesGet("output_indices","i")}  % input_dim_i;

        ${s.indicesSet("input_indices","i","input_dim_value")}
      }
      ${d.setByOffset("global_idx",s.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${n}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:o,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:[{type:12,data:i},...W(t[0].dims,o)]}),getShaderSource:c}},np=t=>{_b(t.inputs),t.compute(vb(t.inputs),{inputs:[0]})}});var $b,xb,ip,ap=V(()=>{"use strict";X();te();oe();$b=(t,e,r,n,o)=>{let i=R("output_data",o,r.length,4),u=O("a_data",e[1].dataType,e[1].dims.length,4),s=O("b_data",e[2].dataType,e[2].dims.length,4),d=O("c_data",e[0].dataType,e[0].dims.length,4),c,p=(f,g,b)=>`select(${g}, ${f}, ${b})`;if(!n)c=i.setByOffset("global_idx",p(u.getByOffset("global_idx"),s.getByOffset("global_idx"),d.getByOffset("global_idx")));else{let f=(g,b,y="")=>{let $=`a_data[index_a${b}][component_a${b}]`,T=`b_data[index_b${b}][component_b${b}]`,_=`bool(c_data[index_c${b}] & (0xffu << (component_c${b} * 8)))`;return`
            let output_indices${b} = ${i.offsetToIndices(`global_idx * 4u + ${b}u`)};
            let offset_a${b} = ${u.broadcastedIndicesToOffset(`output_indices${b}`,i)};
            let offset_b${b} = ${s.broadcastedIndicesToOffset(`output_indices${b}`,i)};
            let offset_c${b} = ${d.broadcastedIndicesToOffset(`output_indices${b}`,i)};
            let index_a${b} = offset_a${b} / 4u;
            let index_b${b} = offset_b${b} / 4u;
            let index_c${b} = offset_c${b} / 4u;
            let component_a${b} = offset_a${b} % 4u;
            let component_b${b} = offset_b${b} % 4u;
            let component_c${b} = offset_c${b} % 4u;
            ${g}[${b}] = ${y}(${p($,T,_)});
          `};o===9?c=`
            var data = vec4<u32>(0);
            ${f("data",0,"u32")}
            ${f("data",1,"u32")}
            ${f("data",2,"u32")}
            ${f("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:c=`
            ${f("output_data[global_idx]",0)}
            ${f("output_data[global_idx]",1)}
            ${f("output_data[global_idx]",2)}
            ${f("output_data[global_idx]",3)}
          `}return`
        ${t.registerUniform("vec_size","u32").declareVariables(d,u,s,i)}
        ${t.mainStart()}
        ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${c}
      }`},xb=t=>{let e=t[1].dims,r=t[2].dims,n=t[0].dims,o=t[1].dataType,i=!(k.areEqual(e,r)&&k.areEqual(r,n)),u=e,s=k.size(e);if(i){let c=ot.calcShape(ot.calcShape(e,r,!1),n,!1);if(!c)throw new Error("Can't perform where op on the given tensors");u=c,s=k.size(u)}let d=Math.ceil(s/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:c=>$b(c,t,u,i,o),getRunData:()=>({outputs:[{dims:u,dataType:o}],dispatchGroup:{x:Math.ceil(s/64/4)},programUniforms:[{type:12,data:d},...W(n,e,r,u)]})}},ip=t=>{t.compute(xb(t.inputs))}});var sp,up=V(()=>{"use strict";Du();ln();Mu();Uu();Sd();zd();Ud();el();sl();ll();ml();vl();Il();El();Pl();Bl();Rl();Vl();Gl();ql();Zl();oc();sc();dc();cc();fc();Vo();gc();Dc();Mc();Uc();Lc();un();qc();Go();jc();Xc();tp();Wo();op();pt();pn();ap();sp=new Map([["Abs",[Nu]],["Acos",[Vu]],["Acosh",[Lu]],["Add",[Td]],["ArgMax",[Ou,Io]],["ArgMin",[Pu,Io]],["Asin",[Wu]],["Asinh",[Gu]],["Atan",[Hu]],["Atanh",[Fu]],["Attention",[Bu]],["AveragePool",[Sc,xc]],["BatchNormalization",[zu]],["BiasAdd",[Ru]],["BiasSplitGelu",[xd]],["Cast",[Ku,qu]],["Ceil",[Zu]],["Clip",[ju]],["Concat",[Md,Rd]],["Conv",[zo,Bo]],["ConvTranspose",[al,ol]],["Cos",[Qu]],["Cosh",[Yu]],["CumSum",[ul,dl]],["DepthToSpace",[cl,pl]],["DequantizeLinear",[Bc,zc]],["DFT",[_l,wl]],["Div",[Id]],["Einsum",[Sl,Tl]],["Elu",[Xu,pr]],["Equal",[Ad]],["Erf",[Ju]],["Exp",[ed]],["Expand",[Cl]],["FastGelu",[kl]],["Floor",[td]],["FusedConv",[zo,Bo]],["Gather",[Dl,Ol]],["GatherElements",[Wl,Ll]],["GatherBlockQuantized",[Ul,Nl]],["GatherND",[zl,Ml]],["Gelu",[rd]],["Gemm",[Fl,Hl]],["GlobalAveragePool",[Ac,Ic]],["GlobalMaxPool",[Oc,Pc]],["Greater",[Pd]],["GreaterOrEqual",[Dd]],["GridSample",[Kl,jl]],["GroupQueryAttention",[nc]],["HardSigmoid",[ld,dd]],["HardSwish",[cd]],["InstanceNormalization",[ac]],["LayerNormalization",[uc]],["LeakyRelu",[nd,pr]],["Less",[Od]],["LessOrEqual",[Bd]],["Log",[wd]],["MatMul",[lc]],["MatMulNBits",[pc,mc]],["MaxPool",[Ec,kc]],["Mul",[Cd]],["MultiHeadAttention",[Xl,Yl]],["Neg",[id]],["Not",[od]],["Pad",[hc]],["Pow",[Ed]],["QuickGelu",[vd,pr]],["Range",[Rc]],["Reciprocal",[ad]],["ReduceMin",[Tu]],["ReduceMean",[wu]],["ReduceMax",[Su]],["ReduceSum",[Au]],["ReduceProd",[Iu]],["ReduceL1",[vu]],["ReduceL2",[$u]],["ReduceLogSum",[Eu]],["ReduceLogSumExp",[xu]],["ReduceSumSquare",[Cu]],["Relu",[sd]],["Resize",[Hc,Fc]],["RotaryEmbedding",[tc]],["ScatterND",[Vc,Nc]],["Sigmoid",[ud]],["Sin",[pd]],["Sinh",[md]],["Slice",[Qc,Yc]],["SkipLayerNormalization",[Kc]],["Split",[Jl,ec]],["Sqrt",[fd]],["Softmax",[Jc,ep]],["Sub",[kd]],["Tan",[hd]],["Tanh",[yd]],["ThresholdedRelu",[_d,pr]],["Tile",[np]],["Transpose",[su,uu]],["Where",[ip]]])});var Sn,dp=V(()=>{"use strict";Ve();nt();oe();Sn=class{constructor(e){this.backend=e;this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,r){this.repo.set(e,r)}run(e,r,n,o,i){Re(e.programInfo.name);let u=this.backend.device,s=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let d=[];for(let p of r)d.push({binding:d.length,resource:{buffer:p.buffer}});for(let p of n)d.push({binding:d.length,resource:{buffer:p.buffer}});i&&d.push({binding:d.length,resource:i});let c=u.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:d,label:e.programInfo.name});if(this.backend.sessionStatus==="capturing"){let p={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:c,dispatchGroup:o};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(p)}s.setPipeline(e.computePipeline),s.setBindGroup(0,c),s.dispatchWorkgroups(...o),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),Me(e.programInfo.name)}dispose(){}build(e,r){Re(e.name);let n=this.backend.device,o=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"}].forEach(f=>{n.features.has(f.feature)&&o.push(`enable ${f.extension};`)});let u=iu(r,this.backend.device.limits),s=e.getShaderSource(u),d=`${o.join(`
`)}
${u.additionalImplementations}
${s}`,c=n.createShaderModule({code:d,label:e.name});ae("verbose",()=>`[WebGPU] ${e.name} shader code: ${d}`);let p=n.createComputePipeline({compute:{module:c,entryPoint:"main"},layout:"auto",label:e.name});return Me(e.name),{programInfo:e,computePipeline:p,uniformVariablesInfo:u.variablesInfo}}normalizeDispatchGroupSize(e){let r=typeof e=="number"?e:e.x,n=typeof e=="number"?1:e.y||1,o=typeof e=="number"?1:e.z||1,i=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(r<=i&&n<=i&&o<=i)return[r,n,o];let u=r*n*o,s=Math.ceil(Math.sqrt(u));if(s>i){if(s=Math.ceil(Math.cbrt(u)),s>i)throw new Error("Total dispatch size exceeds WebGPU maximum.");return[s,s,s]}else return[s,s,1]}}});var lp={};Ht(lp,{WebGpuBackend:()=>Fo});var Sb,Tb,Ho,Fo,cp=V(()=>{"use strict";Ve();X();nt();ho();nu();up();dp();Sb=(t,e)=>{if(e.length!==t.length)throw new Error(`inputDependencies length ${e.length} is not equal to inputTensors length ${t.length}.`);let r=[];for(let n=0;n<t.length;++n){let o=t[n].dataType;switch(e[n]){case"none":{r.push("");break}case"type":{r.push(`${o}`);break}case"rank":{let i=t[n].dims.length;r.push(`${o};${i}`);break}case"dims":{let i=t[n].dims.join(",");r.push(`${o};${i}`);break}default:throw new Error(`unsupported input dependency: ${e[n]}`)}}return r.join("|")},Tb=(t,e,r)=>{let n=t.name;return t.shaderCache?.hint&&(n+="["+t.shaderCache.hint+"]"),n+=":"+r+`:${Sb(e,t.shaderCache?.inputDependencies??new Array(e.length).fill("dims"))}`,n},Ho=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},Fo=class{constructor(){this.currentSessionId=null;this.currentKernelId=null;this.commandEncoder=null;this.computePassEncoder=null;this.maxDispatchNumber=16;this.pendingDispatchNumber=0;this.pendingKernels=[];this.pendingQueries=new Map;this.sessionStatus="default";this.capturedCommandList=new Map;this.capturedPendingKernels=new Map;this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,r){this.env=e;let n=[],o={requiredLimits:{maxComputeWorkgroupStorageSize:r.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:r.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize,maxBufferSize:r.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:r.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:r.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:r.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:r.limits.maxComputeWorkgroupSizeZ},requiredFeatures:n},i=d=>r.features.has(d)&&n.push(d)&&!0;i("chromium-experimental-timestamp-query-inside-passes")||i("timestamp-query"),i("shader-f16"),i("subgroups"),this.device=await r.requestDevice(o);let u=r,s=r.info??(typeof u.requestAdapterInfo=="function"?await u.requestAdapterInfo():void 0);this.adapterInfo=new Ho(s),this.gpuDataManager=ru(this),this.programManager=new Sn(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,Yr(e.logLevel,!!e.debug),this.device.onuncapturederror=d=>{d.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${d.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!0}),Object.defineProperty(this.env.webgpu,"adapter",{value:r,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose(),this.device&&this.env?.webgpu&&this.device.lost.then(()=>{delete this.env.webgpu.device})}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),r={};this.queryType==="at-passes"&&(r.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(r)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;Re(),this.endComputePass();let e;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&e.mapAsync(GPUMapMode.READ).then(()=>{let r=new BigUint64Array(e.getMappedRange()),n=this.pendingQueries.get(e);for(let o=0;o<r.length/2;o++){let i=n[o],u=i.kernelId,s=this.kernels.get(u),d=s.kernelType,c=s.kernelName,p=i.programName,f=i.inputTensorViews,g=i.outputTensorViews,b=r[o*2],y=r[o*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=b);let $=Number(b-this.queryTimeBase),T=Number(y-this.queryTimeBase);if(!Number.isSafeInteger($)||!Number.isSafeInteger(T))throw new RangeError("incorrect timestamp range");if(this.env.webgpu.profiling?.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:f.map(_=>({dims:_.dims,dataType:rt(_.dataType)})),outputsMetadata:g.map(_=>({dims:_.dims,dataType:rt(_.dataType)})),kernelId:u,kernelType:d,kernelName:c,programName:p,startTime:$,endTime:T});else{let _="";f.forEach((S,I)=>{_+=`input[${I}]: [${S.dims}] | ${rt(S.dataType)}, `});let w="";g.forEach((S,I)=>{w+=`output[${I}]: [${S.dims}] | ${rt(S.dataType)}, `}),console.log(`[profiling] kernel "${u}|${d}|${c}|${p}" ${_}${w}start time: ${$} ns, execution time: ${T-$} ns`)}Or("GPU",`${p}::${b}::${y}`)}e.unmap(),this.pendingQueries.delete(e)}),Me()}run(e,r,n,o,i,u){Re(e.name);let s=[];for(let S=0;S<r.length;++S){let I=r[S].data;if(I===0)continue;let C=this.gpuDataManager.get(I);if(!C)throw new Error(`no GPU data for input: ${I}`);s.push(C)}let{outputs:d,dispatchGroup:c,programUniforms:p}=e.getRunData(r),f=n.length===0?d.map((S,I)=>I):n;if(f.length!==d.length)throw new Error(`Output size ${f.length} must be equal to ${d.length}.`);let g=[],b=[];for(let S=0;S<d.length;++S){if(!Number.isInteger(f[S])||f[S]<-3||f[S]>=u)throw new Error(`Invalid output index: ${f[S]}`);if(f[S]===-3)continue;let I=f[S]===-1,C=f[S]===-2,E=I||C?i(d[S].dataType,d[S].dims):o(f[S],d[S].dataType,d[S].dims);if(g.push(E),E.data===0)continue;let B=this.gpuDataManager.get(E.data);if(!B)throw new Error(`no GPU data for output: ${E.data}`);if(I&&this.temporaryData.push(B),C){let x=this.kernelPersistentData.get(this.currentKernelId);x||(x=[],this.kernelPersistentData.set(this.currentKernelId,x)),x.push(B)}b.push(B)}if(s.length!==r.length||b.length!==g.length){if(b.length===0)return Me(e.name),g;throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let y;if(p){let S=0,I=[];p.forEach(x=>{let U=typeof x.data=="number"?[x.data]:x.data;if(U.length===0)return;let N=x.type===10?2:4,F,Z;x.type===10?(Z=U.length>4?16:U.length>2?8:U.length*N,F=U.length>4?16:N*U.length):(Z=U.length<=2?U.length*N:16,F=16),S=Math.ceil(S/Z)*Z,I.push(S);let ee=x.type===10?8:4;S+=U.length>4?Math.ceil(U.length/ee)*F:U.length*N});let C=16;S=Math.ceil(S/C)*C;let E=new ArrayBuffer(S);p.forEach((x,U)=>{let N=I[U],F=typeof x.data=="number"?[x.data]:x.data;if(x.type===6)new Int32Array(E,N,F.length).set(F);else if(x.type===12)new Uint32Array(E,N,F.length).set(F);else if(x.type===10)new Uint16Array(E,N,F.length).set(F);else if(x.type===1)new Float32Array(E,N,F.length).set(F);else throw new Error(`Unsupported uniform type: ${rt(x.type)}`)});let B=this.gpuDataManager.create(S,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(B.buffer,0,E,0,S),this.gpuDataManager.release(B.id),y={offset:0,size:S,buffer:B.buffer}}let $=this.programManager.normalizeDispatchGroupSize(c),T=$[1]===1&&$[2]===1,_=Tb(e,r,T),w=this.programManager.getArtifact(_);if(w||(w=this.programManager.build(e,$),this.programManager.setArtifact(_,w),ae("info",()=>`[artifact] key: ${_}, programName: ${e.name}`)),p&&w.uniformVariablesInfo){if(p.length!==w.uniformVariablesInfo.length)throw new Error(`Uniform variables count mismatch: expect ${w.uniformVariablesInfo.length}, got ${p.length} in program "${w.programInfo.name}".`);for(let S=0;S<p.length;S++){let I=p[S],C=I.type,E=typeof I.data=="number"?1:I.data.length,[B,x]=w.uniformVariablesInfo[S];if(C!==B||E!==x)throw new Error(`Uniform variable ${S} mismatch: expect type ${B} with size ${x}, got type ${C} with size ${E} in program "${w.programInfo.name}".`)}}if(ae("info",()=>`[ProgramManager] run "${e.name}" (key=${_}) with ${$[0]}x${$[1]}x${$[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let S={kernelId:this.currentKernelId,programName:w.programInfo.name,inputTensorViews:r,outputTensorViews:g};this.pendingKernels.push(S),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(S)}return this.programManager.run(w,s,b,$,y),Me(e.name),g}upload(e,r){this.gpuDataManager.upload(e,r)}memcpy(e,r){this.gpuDataManager.memcpy(e,r)}async download(e,r){await this.gpuDataManager.download(e,r)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,r,n,o){let i=sp.get(e);if(!i)throw new Error(`kernel not implemented: ${e}`);let u={kernelType:e,kernelName:o,kernelEntry:i[0],attributes:[i[1],n]};this.kernels.set(r,u)}releaseKernel(e){let r=this.kernelPersistentData.get(e);if(r){for(let n of r)this.gpuDataManager.release(n.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,r,n){let o=this.kernels.get(e);if(!o)throw new Error(`kernel not created: ${e}`);let i=o.kernelType,u=o.kernelName,s=o.kernelEntry,d=o.attributes;if(this.currentKernelId!==null)throw new Error(`kernel "[${i}] ${u}" is not allowed to be called recursively`);this.currentKernelId=e,d[0]&&(d[1]=d[0](d[1]),d[0]=void 0),ae("info",()=>`[WebGPU] Start to run kernel "[${i}] ${u}"...`);let c=this.env.debug;this.temporaryData=[];try{return c&&this.device.pushErrorScope("validation"),s(r,d[1]),0}catch(p){return n.push(Promise.resolve(`[WebGPU] Kernel "[${i}] ${u}" failed. ${p}`)),1}finally{c&&n.push(this.device.popErrorScope().then(p=>p?`GPU validation error for kernel "[${i}] ${u}": ${p.message}`:null));for(let p of this.temporaryData)this.gpuDataManager.release(p.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,r,n,o){let i=this.sessionExternalDataMapping.get(e);i||(i=new Map,this.sessionExternalDataMapping.set(e,i));let u=i.get(r),s=this.gpuDataManager.registerExternalBuffer(n,o,u);return i.set(r,[s,n]),s}unregisterBuffers(e){let r=this.sessionExternalDataMapping.get(e);r&&(r.forEach(n=>this.gpuDataManager.unregisterExternalBuffer(n[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let r=this.gpuDataManager.get(e);if(!r)throw new Error(`no GPU data for buffer: ${e}`);return r.buffer}createDownloader(e,r,n){return async()=>{let o=await wo(this,e,r);return Jr(o.buffer,n)}}writeTimestamp(e){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){this.queryType="none",(this.env.webgpu.profiling?.mode==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){ae("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){ae("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){ae("info","replay"),this.sessionStatus="replaying";let e=this.capturedCommandList.get(this.currentSessionId),r=this.capturedPendingKernels.get(this.currentSessionId),n=e.length;this.pendingKernels=[];for(let o=0;o<n;o++){let i=this.getComputePassEncoder(),u=e[o];this.writeTimestamp(this.pendingDispatchNumber*2),i.setPipeline(u.computePipeline),i.setBindGroup(0,u.bindGroup),i.dispatchWorkgroups(...u.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(r[o]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}});var pp={};Ht(pp,{init:()=>Ib});var gr,qo,Ib,mp=V(()=>{"use strict";X();nt();te();Xs();gr=class t{constructor(e,r,n,o){this.module=e;this.dataType=r;this.data=n;this.dims=o}getFloat32Array(){if(this.dataType!==1)throw new Error("Invalid data type");let e=k.size(this.dims);return e===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,e)}getBigInt64Array(){if(this.dataType!==7)throw new Error("Invalid data type");let e=k.size(this.dims);return e===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,e)}getInt32Array(){if(this.dataType!==6)throw new Error("Invalid data type");let e=k.size(this.dims);return e===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,e)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw new Error("Invalid data type");let e=k.size(this.dims);return e===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,e)}reshape(e){if(k.size(e)!==k.size(this.dims))throw new Error("Invalid new shape");return new t(this.module,this.dataType,this.data,e)}},qo=class{constructor(e,r,n){this.module=e;this.backend=r;this.customDataOffset=0;this.customDataSize=0;this.adapterInfo=r.adapterInfo,this.deviceLimits=r.device.limits;let o=e.PTR_SIZE,i=n/e.PTR_SIZE,u=o===4?"i32":"i64";this.opKernelContext=Number(e.getValue(o*i++,u));let s=Number(e.getValue(o*i++,u));this.outputCount=Number(e.getValue(o*i++,u)),this.customDataOffset=Number(e.getValue(o*i++,"*")),this.customDataSize=Number(e.getValue(o*i++,u));let d=[];for(let c=0;c<s;c++){let p=Number(e.getValue(o*i++,u)),f=Number(e.getValue(o*i++,"*")),g=Number(e.getValue(o*i++,u)),b=[];for(let y=0;y<g;y++)b.push(Number(e.getValue(o*i++,u)));d.push(new gr(e,p,f,b))}this.inputs=d}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,r){let n=r?.inputs?.map(s=>typeof s=="number"?this.inputs[s]:s)??this.inputs,o=r?.outputs??[],i=(s,d,c)=>new gr(this.module,d,this.output(s,c),c),u=(s,d)=>{let c=It(s,d);if(!c)throw new Error(`Unsupported data type: ${s}`);let p=c>0?this.backend.gpuDataManager.create(c).id:0;return new gr(this.module,s,p,d)};return this.backend.run(e,n,o,i,u,this.outputCount)}output(e,r){let n=this.module.stackSave();try{let o=this.module.PTR_SIZE,i=o===4?"i32":"i64",u=this.module.stackAlloc((1+r.length)*o);this.module.setValue(u,r.length,i);for(let s=0;s<r.length;s++)this.module.setValue(u+o*(s+1),r[s],i);return this.module._JsepOutput(this.opKernelContext,e,u)}catch(o){throw new Error(`Failed to generate kernel's output[${e}] with dims [${r}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${o}`)}finally{this.module.stackRestore(n)}}},Ib=async(t,e,r,n)=>{let o=e.jsepInit;if(!o)throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(t==="webgpu"){let i=(cp(),ar(lp)).WebGpuBackend,u=new i;await u.initialize(r,n),o("webgpu",[u,s=>u.alloc(Number(s)),s=>u.free(s),(s,d,c,p=!1)=>{if(p)ae("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(s)}, dst=${Number(d)}, size=${Number(c)}`),u.memcpy(Number(s),Number(d));else{ae("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(s)}, gpuDataId=${Number(d)}, size=${Number(c)}`);let f=e.HEAPU8.subarray(Number(s>>>0),Number(s>>>0)+Number(c));u.upload(Number(d),f)}},async(s,d,c)=>{ae("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${s}, dataOffset=${d}, size=${c}`),await u.download(Number(s),()=>e.HEAPU8.subarray(Number(d)>>>0,Number(d+c)>>>0))},(s,d,c)=>u.createKernel(s,Number(d),c,e.UTF8ToString(e._JsepGetNodeName(Number(d)))),s=>u.releaseKernel(s),(s,d,c,p)=>{ae("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${c}, kernel=${s}, contextDataOffset=${d}`);let f=new qo(e,u,Number(d));return u.computeKernel(Number(s),f,p)},()=>u.captureBegin(),()=>u.captureEnd(),()=>u.replay()])}else{let i=new nn(r);o("webnn",[i,()=>i.reserveTensorId(),u=>i.releaseTensorId(u),async(u,s,d,c,p)=>i.ensureTensor(u,s,d,c,p),(u,s)=>{i.uploadTensor(u,s)},async(u,s)=>i.downloadTensor(u,s),(u,s)=>i.registerMLContext(u,s),!!r.trace])}}});var Ab,Nr,Vr,Lt,Cb,fp,dr,Lr,Wr,Tn,Eb,Yt,gp,yp,hp,Gr,Hr,Fr,so=V(()=>{"use strict";Ve();Ns();Ls();X();St();Kr();Qr();Ab=(t,e)=>{pe()._OrtInit(t,e)!==0&&me("Can't initialize onnxruntime.")},Nr=async t=>{Ab(t.wasm.numThreads,cr(t.logLevel))},Vr=async(t,e)=>{pe().asyncInit?.();let r=t.webgpu.adapter;if(e==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if(r){if(typeof r.limits!="object"||typeof r.features!="object"||typeof r.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let n=t.webgpu.powerPreference;if(n!==void 0&&n!=="low-power"&&n!=="high-performance")throw new Error(`Invalid powerPreference setting: "${n}"`);let o=t.webgpu.forceFallbackAdapter;if(o!==void 0&&typeof o!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${o}"`);if(r=await navigator.gpu.requestAdapter({powerPreference:n,forceFallbackAdapter:o}),!r)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(e==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment");{let n=(mp(),ar(pp)).init;e==="webgpu"&&await n("webgpu",pe(),t,r),e==="webnn"&&await n("webnn",pe(),t)}},Lt=new Map,Cb=t=>{let e=pe(),r=e.stackSave();try{let n=e.PTR_SIZE,o=e.stackAlloc(2*n);e._OrtGetInputOutputCount(t,o,o+n)!==0&&me("Can't get session input/output count.");let u=n===4?"i32":"i64";return[Number(e.getValue(o,u)),Number(e.getValue(o+n,u))]}finally{e.stackRestore(r)}},fp=(t,e)=>{let r=pe(),n=r.stackSave(),o=0;try{let i=r.PTR_SIZE,u=r.stackAlloc(2*i);r._OrtGetInputOutputMetadata(t,e,u,u+i)!==0&&me("Can't get session input/output metadata.");let d=Number(r.getValue(u,"*"));o=Number(r.getValue(u+i,"*"));let c=r.HEAP32[o/4];if(c===0)return[d,0];let p=r.HEAPU32[o/4+1],f=[];for(let g=0;g<p;g++){let b=Number(r.getValue(o+8+g*i,"*"));f.push(b!==0?r.UTF8ToString(b):Number(r.getValue(o+8+(g+p)*i,"*")))}return[d,c,f]}finally{r.stackRestore(n),o!==0&&r._OrtFree(o)}},dr=t=>{let e=pe(),r=e._malloc(t.byteLength);if(r===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${t.byteLength}.`);return e.HEAPU8.set(t,r),[r,t.byteLength]},Lr=async(t,e)=>{let r,n,o=pe();Array.isArray(t)?[r,n]=t:t.buffer===o.HEAPU8.buffer?[r,n]=[t.byteOffset,t.byteLength]:[r,n]=dr(t);let i=0,u=0,s=0,d=[],c=[],p=[];try{if([u,d]=await Vs(e),e?.externalData&&o.mountExternalData){let I=[];for(let C of e.externalData){let E=typeof C=="string"?C:C.path,B=typeof C=="string"?C:C.data;I.push(Mt(B).then(x=>{o.mountExternalData(E,x)}))}await Promise.all(I)}for(let I of e?.executionProviders??[])if((typeof I=="string"?I:I.name)==="webnn"){if(o.shouldTransferToMLTensor=!1,typeof I!="string"){let E=I,B=E?.context,x=E?.gpuDevice,U=E?.deviceType,N=E?.powerPreference;B?o.currentContext=B:x?o.currentContext=await o.webnnCreateMLContext(x):o.currentContext=await o.webnnCreateMLContext({deviceType:U,powerPreference:N})}else o.currentContext=await o.webnnCreateMLContext();break}i=await o._OrtCreateSession(r,n,u),o.webgpuOnCreateSession?.(i),i===0&&me("Can't create a session."),o.jsepOnCreateSession?.(),o.currentContext&&(o.webnnRegisterMLContext(i,o.currentContext),o.currentContext=void 0,o.shouldTransferToMLTensor=!0);let[f,g]=Cb(i),b=!!e?.enableGraphCapture,y=[],$=[],T=[],_=[],w=[];for(let I=0;I<f;I++){let[C,E,B]=fp(i,I);C===0&&me("Can't get an input name."),c.push(C);let x=o.UTF8ToString(C);y.push(x),T.push(E===0?{name:x,isTensor:!1}:{name:x,isTensor:!0,type:rt(E),shape:B})}for(let I=0;I<g;I++){let[C,E,B]=fp(i,I+f);C===0&&me("Can't get an output name."),p.push(C);let x=o.UTF8ToString(C);$.push(x),_.push(E===0?{name:x,isTensor:!1}:{name:x,isTensor:!0,type:rt(E),shape:B});{if(b&&e?.preferredOutputLocation===void 0){w.push("gpu-buffer");continue}let U=typeof e?.preferredOutputLocation=="string"?e.preferredOutputLocation:e?.preferredOutputLocation?.[x]??"cpu",N=o.webnnIsGraphOutput;if(U==="cpu"&&N&&N(i,x)){w.push("ml-tensor-cpu-output");continue}if(U!=="cpu"&&U!=="cpu-pinned"&&U!=="gpu-buffer"&&U!=="ml-tensor")throw new Error(`Not supported preferred output location: ${U}.`);if(b&&U!=="gpu-buffer")throw new Error(`Not supported preferred output location: ${U}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);w.push(U)}}let S=null;return w.some(I=>I==="gpu-buffer"||I==="ml-tensor"||I==="ml-tensor-cpu-output")&&(s=o._OrtCreateBinding(i),s===0&&me("Can't create IO binding."),S={handle:s,outputPreferredLocations:w,outputPreferredLocationsEncoded:w.map(I=>I==="ml-tensor-cpu-output"?"ml-tensor":I).map(I=>mo(I))}),Lt.set(i,[i,c,p,S,b,!1]),[i,y,$,T,_]}catch(f){throw c.forEach(g=>o._OrtFree(g)),p.forEach(g=>o._OrtFree(g)),s!==0&&o._OrtReleaseBinding(s)!==0&&me("Can't release IO binding."),i!==0&&o._OrtReleaseSession(i)!==0&&me("Can't release session."),f}finally{o._free(r),u!==0&&o._OrtReleaseSessionOptions(u)!==0&&me("Can't release session options."),d.forEach(f=>o._free(f)),o.unmountExternalData?.()}},Wr=t=>{let e=pe(),r=Lt.get(t);if(!r)throw new Error(`cannot release session. invalid session id: ${t}`);let[n,o,i,u,s]=r;u&&(s&&e._OrtClearBoundOutputs(u.handle)!==0&&me("Can't clear bound outputs."),e._OrtReleaseBinding(u.handle)!==0&&me("Can't release IO binding.")),e.jsepOnReleaseSession?.(t),e.webnnOnReleaseSession?.(t),e.webgpuOnReleaseSession?.(t),o.forEach(d=>e._OrtFree(d)),i.forEach(d=>e._OrtFree(d)),e._OrtReleaseSession(n)!==0&&me("Can't release session."),Lt.delete(t)},Tn=new Map,Eb=1,Yt=new Map,gp=t=>{let e=pe(),r=e._malloc(t.byteLength);if(r===0)throw new Error(`Can't create a LoRA adapter. failed to allocate a buffer of size ${t.byteLength}.`);try{e.HEAPU8.set(t,r);let n=e._OrtCreateLoraAdapter(r,t.byteLength);n===0&&me("Can't create a LoRA adapter.");let o=Eb++;return Tn.set(o,n),o}finally{e._free(r)}},yp=t=>{let e=pe(),r=Tn.get(t);if(r===void 0)throw new Error(`cannot release LoRA adapter. invalid adapter id: ${t}`);if(Yt.has(t))throw new Error(`cannot release LoRA adapter. the adapter is used by a run in progress. adapter id: ${t}`);e._OrtReleaseLoraAdapter(r)!==0&&me("Can't release LoRA adapter."),Tn.delete(t)},hp=async(t,e,r,n,o,i,u=!1)=>{if(!t){e.push(0);return}let s=pe(),d=s.PTR_SIZE,c=t[0],p=t[1],f=t[3],g=f,b,y;if(c==="string"&&(f==="gpu-buffer"||f==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(u&&f!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${i} when enableGraphCapture is true.`);if(f==="gpu-buffer"){let _=t[2].gpuBuffer;y=It(Tt(c),p);{let w=s.jsepRegisterBuffer;if(!w)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');b=w(n,i,_,y)}}else if(f==="ml-tensor"){let _=t[2].mlTensor;y=It(Tt(c),p);let w=s.webnnRegisterMLTensor;if(!w)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');b=w(n,_,Tt(c),p)}else{let _=t[2];if(Array.isArray(_)){y=d*_.length,b=s._malloc(y),r.push(b);for(let w=0;w<_.length;w++){if(typeof _[w]!="string")throw new TypeError(`tensor data at index ${w} is not a string`);s.setValue(b+w*d,Ge(_[w],r),"*")}}else{let w=s.webnnIsGraphInput,S=s.webnnIsGraphOutput;if(c!=="string"&&w&&S){let I=s.UTF8ToString(o);if(w(n,I)||S(n,I)){let C=Tt(c);y=It(C,p),g="ml-tensor";let E=s.webnnCreateTemporaryTensor,B=s.webnnUploadTensor;if(!E||!B)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let x=await E(n,C,p);B(x,new Uint8Array(_.buffer,_.byteOffset,_.byteLength)),b=x}else y=_.byteLength,b=s._malloc(y),r.push(b),s.HEAPU8.set(new Uint8Array(_.buffer,_.byteOffset,y),b)}else y=_.byteLength,b=s._malloc(y),r.push(b),s.HEAPU8.set(new Uint8Array(_.buffer,_.byteOffset,y),b)}}let $=s.stackSave(),T=s.stackAlloc(4*p.length);try{p.forEach((w,S)=>s.setValue(T+S*d,w,d===4?"i32":"i64"));let _=s._OrtCreateTensor(Tt(c),b,y,T,p.length,mo(g));_===0&&me(`Can't create tensor for input/output. session=${n}, index=${i}.`),e.push(_)}finally{s.stackRestore($)}},Gr=async(t,e,r,n,o,i,u=[])=>{let s=pe(),d=s.PTR_SIZE,c=Lt.get(t);if(!c)throw new Error(`cannot run inference. invalid session id: ${t}`);let p=c[0],f=c[1],g=c[2],b=c[3],y=c[4],$=c[5],T=[];if(u.length>0){if(b)throw new Error("LoRA adapters are not supported for a session that uses IO binding, e.g. when an output is preferred to be on GPU, or when the WebNN execution provider produces an output.");for(let D of u){let j=Tn.get(D);if(j===void 0)throw new Error(`cannot run inference. invalid LoRA adapter id: ${D}`);T.push(j)}}let _=e.length,w=n.length,S=0,I=[],C=[],E=[],B=[],x=[],U=s.stackSave(),N=s.stackAlloc(_*d),F=s.stackAlloc(_*d),Z=s.stackAlloc(w*d),ee=s.stackAlloc(w*d);try{for(let L of u)Yt.set(L,(Yt.get(L)??0)+1);[S,I]=Us(i,T),$t("wasm prepareInputOutputTensor");for(let L=0;L<_;L++)await hp(r[L],C,B,t,f[e[L]],e[L],y);for(let L=0;L<w;L++)await hp(o[L],E,B,t,g[n[L]],_+n[L],y);xt("wasm prepareInputOutputTensor");for(let L=0;L<_;L++)s.setValue(N+L*d,C[L],"*"),s.setValue(F+L*d,f[e[L]],"*");for(let L=0;L<w;L++)s.setValue(Z+L*d,E[L],"*"),s.setValue(ee+L*d,g[n[L]],"*");if(b&&!$){let{handle:L,outputPreferredLocations:J,outputPreferredLocationsEncoded:le}=b;if(f.length!==_)throw new Error(`input count from feeds (${_}) is expected to be always equal to model's input count (${f.length}).`);$t("wasm bindInputsOutputs");for(let ne=0;ne<_;ne++){let be=e[ne];await s._OrtBindInput(L,f[be],C[ne])!==0&&me(`Can't bind input[${ne}] for session=${t}.`)}for(let ne=0;ne<w;ne++){let be=n[ne];o[ne]?.[3]?(x.push(E[ne]),s._OrtBindOutput(L,g[be],E[ne],0)!==0&&me(`Can't bind pre-allocated output[${ne}] for session=${t}.`)):s._OrtBindOutput(L,g[be],0,le[be])!==0&&me(`Can't bind output[${ne}] to ${J[ne]} for session=${t}.`)}xt("wasm bindInputsOutputs"),Lt.set(t,[p,f,g,b,y,!0])}s.jsepOnRunStart?.(p),s.webnnOnRunStart?.(p);let D;b?D=await s._OrtRunWithBinding(p,b.handle,w,Z,S):D=await s._OrtRun(p,F,N,_,ee,w,Z,S),D!==0&&me("failed to call OrtRun().");let j=[],Y=[];$t("wasm ProcessOutputTensor");for(let L=0;L<w;L++){let J=Number(s.getValue(Z+L*d,"*"));if(J===E[L]||x.includes(E[L])){j.push(o[L]),J!==E[L]&&s._OrtReleaseTensor(J)!==0&&me("Can't release tensor.");continue}let le=s.stackSave(),ne=s.stackAlloc(4*d),be=!1,fe,ue=0;try{s._OrtGetTensorData(J,ne,ne+d,ne+2*d,ne+3*d)!==0&&me(`Can't access output tensor data on index ${L}.`);let G=d===4?"i32":"i64",he=Number(s.getValue(ne,G));ue=s.getValue(ne+d,"*");let Ne=s.getValue(ne+d*2,"*"),Ae=Number(s.getValue(ne+d*3,G)),ke=[];for(let Pe=0;Pe<Ae;Pe++)ke.push(Number(s.getValue(Ne+Pe*d,G)));s._OrtFree(Ne)!==0&&me("Can't free memory for tensor dims.");let Ce=ke.reduce((Pe,xe)=>Pe*xe,1);fe=rt(he);let qe=b?.outputPreferredLocations[n[L]];if(fe==="string"){if(qe==="gpu-buffer"||qe==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let Pe=[];for(let xe=0;xe<Ce;xe++){let ge=s.getValue(ue+xe*d,"*"),ht=s.getValue(ue+(xe+1)*d,"*"),tr=xe===Ce-1?void 0:ht-ge;Pe.push(s.UTF8ToString(ge,tr))}j.push([fe,ke,Pe,"cpu"])}else if(qe==="gpu-buffer"&&Ce>0){let Pe=s.jsepGetBuffer;if(!Pe)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let xe=Pe(ue),ge=It(he,Ce);if(ge===void 0||!jr(fe))throw new Error(`Unsupported data type: ${fe}`);be=!0,j.push([fe,ke,{gpuBuffer:xe,download:s.jsepCreateDownloader(xe,ge,fe),dispose:()=>{s._OrtReleaseTensor(J)!==0&&me("Can't release tensor.")}},"gpu-buffer"])}else if(qe==="ml-tensor"&&Ce>0){let Pe=s.webnnEnsureTensor,xe=s.webnnIsGraphInputOutputTypeSupported;if(!Pe||!xe)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(It(he,Ce)===void 0||!Zr(fe))throw new Error(`Unsupported data type: ${fe}`);if(!xe(t,fe,!1))throw new Error(`preferredLocation "ml-tensor" for ${fe} output is not supported by current WebNN Context.`);let ht=await Pe(t,ue,he,ke,!1);be=!0,j.push([fe,ke,{mlTensor:ht,download:s.webnnCreateMLTensorDownloader(ue,fe),dispose:()=>{s.webnnReleaseTensorId(ue),s._OrtReleaseTensor(J)}},"ml-tensor"])}else if(qe==="ml-tensor-cpu-output"&&Ce>0){let Pe=s.webnnCreateMLTensorDownloader(ue,fe)(),xe=j.length;be=!0,Y.push((async()=>{let ge=[xe,await Pe];return s.webnnReleaseTensorId(ue),s._OrtReleaseTensor(J),ge})()),j.push([fe,ke,[],"cpu"])}else{let Pe=Kt(fe),xe=new Pe(Ce);new Uint8Array(xe.buffer,xe.byteOffset,xe.byteLength).set(s.HEAPU8.subarray(ue,ue+xe.byteLength)),j.push([fe,ke,xe,"cpu"])}}finally{s.stackRestore(le),fe==="string"&&ue&&s._free(ue),be||s._OrtReleaseTensor(J)}}b&&!y&&(s._OrtClearBoundOutputs(b.handle)!==0&&me("Can't clear bound outputs."),Lt.set(t,[p,f,g,b,y,!1]));for(let[L,J]of await Promise.all(Y))j[L][2]=J;return xt("wasm ProcessOutputTensor"),j}finally{s.webnnOnRunEnd?.(p),s.stackRestore(U),C.forEach(D=>s._OrtReleaseTensor(D)),E.forEach(D=>s._OrtReleaseTensor(D)),B.forEach(D=>s._free(D)),S!==0&&s._OrtReleaseRunOptions(S),I.forEach(D=>s._free(D));for(let D of u){let j=Yt.get(D)-1;j===0?Yt.delete(D):Yt.set(D,j)}}},Hr=t=>{let e=pe(),r=Lt.get(t);if(!r)throw new Error("invalid session id");let n=r[0],o=e._OrtEndProfiling(n);o===0&&me("Can't get an profile file name."),e._OrtFree(o)},Fr=t=>{let e=[];for(let r of t){let n=r[2];!Array.isArray(n)&&"buffer"in n&&e.push(n.buffer)}return e}});var ft,Fe,yr,An,Cn,In,Ko,jo,Xt,Jt,Pb,bp,_p,wp,vp,$p,xp,Sp,Tp,Ip,En=V(()=>{"use strict";Ve();so();St();Rr();Qr();ft=()=>!!ve.wasm.proxy&&typeof document<"u",yr=!1,An=!1,Cn=!1,jo=new Map,Xt=(t,e)=>{let r=jo.get(t);r?r.push(e):jo.set(t,[e])},Jt=()=>{if(yr||!An||Cn||!Fe)throw new Error("worker not ready")},Pb=t=>{switch(t.data.type){case"init-wasm":yr=!1,t.data.err?(Cn=!0,Ko[1](t.data.err)):(An=!0,Ko[0]()),In&&(URL.revokeObjectURL(In),In=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let e=jo.get(t.data.type);t.data.err?e.shift()[1](t.data.err):e.shift()[0](t.data.out);break}default:}},bp=async()=>{if(!An){if(yr)throw new Error("multiple calls to 'initWasm()' detected.");if(Cn)throw new Error("previous call to 'initWasm()' failed.");if(yr=!0,ft())return new Promise((t,e)=>{Fe?.terminate(),zs().then(([r,n])=>{try{Fe=n,Fe.onerror=i=>e(i),Fe.onmessage=Pb,Ko=[t,e];let o={type:"init-wasm",in:ve};!o.in.wasm.wasmPaths&&(r||lo)&&(o.in.wasm.wasmPaths={wasm:new URL("ort-wasm-simd-threaded.jsep.wasm",import.meta.url).href}),Fe.postMessage(o),In=r}catch(o){e(o)}},e)});try{await Ur(ve.wasm),await Nr(ve),An=!0}catch(t){throw Cn=!0,t}finally{yr=!1}}},_p=async t=>{if(ft())return Jt(),new Promise((e,r)=>{Xt("init-ep",[e,r]);let n={type:"init-ep",in:{epName:t,env:ve}};Fe.postMessage(n)});await Vr(ve,t)},wp=async t=>ft()?(Jt(),new Promise((e,r)=>{Xt("copy-from",[e,r]);let n={type:"copy-from",in:{buffer:t}};Fe.postMessage(n,[t.buffer])})):dr(t),vp=async(t,e)=>{if(ft()){if(e?.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return Jt(),new Promise((r,n)=>{Xt("create",[r,n]);let o={type:"create",in:{model:t,options:{...e}}},i=[];t instanceof Uint8Array&&i.push(t.buffer),Fe.postMessage(o,i)})}else return Lr(t,e)},$p=async t=>{if(ft())return Jt(),new Promise((e,r)=>{Xt("release",[e,r]);let n={type:"release",in:t};Fe.postMessage(n)});Wr(t)},xp=async t=>{if(ft())throw new Error("LoRA adapter is not supported for proxy.");let e=typeof t=="string"?await Mt(t):t;return gp(e)},Sp=async t=>{if(ft())throw new Error("LoRA adapter is not supported for proxy.");yp(t)},Tp=async(t,e,r,n,o,i,u)=>{if(ft()){if(u.length>0)throw new Error("LoRA adapter is not supported for proxy.");if(r.some(s=>s[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(o.some(s=>s))throw new Error("pre-allocated output tensor is not supported for proxy.");return Jt(),new Promise((s,d)=>{Xt("run",[s,d]);let c=r,p={type:"run",in:{sessionId:t,inputIndices:e,inputs:c,outputIndices:n,options:i}};Fe.postMessage(p,Fr(c))})}else return Gr(t,e,r,n,o,i,u)},Ip=async t=>{if(ft())return Jt(),new Promise((e,r)=>{Xt("end-profiling",[e,r]);let n={type:"end-profiling",in:t};Fe.postMessage(n)});Hr(t)}});var er,Zo=V(()=>{"use strict";Ve();En();er=class{async loadAdapter(e){Re(),this.adapterId=await xp(e),Me()}async dispose(){return Sp(this.adapterId)}}});var Ap,Ob,kn,Cp=V(()=>{"use strict";Ve();Zo();En();X();Mr();Qr();Ap=(t,e)=>{switch(t.location){case"cpu":return[t.type,t.dims,t.data,"cpu"];case"gpu-buffer":return[t.type,t.dims,{gpuBuffer:t.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[t.type,t.dims,{mlTensor:t.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${t.location} for ${e()}`)}},Ob=t=>{switch(t[3]){case"cpu":return new je(t[0],t[2],t[1]);case"gpu-buffer":{let e=t[0];if(!jr(e))throw new Error(`not supported data type: ${e} for deserializing GPU tensor`);let{gpuBuffer:r,download:n,dispose:o}=t[2];return je.fromGpuBuffer(r,{dataType:e,dims:t[1],download:n,dispose:o})}case"ml-tensor":{let e=t[0];if(!Zr(e))throw new Error(`not supported data type: ${e} for deserializing MLTensor tensor`);let{mlTensor:r,download:n,dispose:o}=t[2];return je.fromMLTensor(r,{dataType:e,dims:t[1],download:n,dispose:o})}default:throw new Error(`invalid data location: ${t[3]}`)}},kn=class{async fetchModelAndCopyToWasmMemory(e){return wp(await Mt(e))}async loadModel(e,r){Re();let n;typeof e=="string"?n=await this.fetchModelAndCopyToWasmMemory(e):n=e,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await vp(n,r),Me()}async dispose(){return $p(this.sessionId)}async run(e,r,n,o=[]){Re();let i=o.map(y=>{if(!(y instanceof er))throw new Error("LoRA adapter was not created by the WebAssembly backend.");return y.adapterId}),u=[],s=[];Object.entries(e).forEach(y=>{let $=y[0],T=y[1],_=this.inputNames.indexOf($);if(_===-1)throw new Error(`invalid input '${$}'`);u.push(T),s.push(_)});let d=[],c=[];Object.entries(r).forEach(y=>{let $=y[0],T=y[1],_=this.outputNames.indexOf($);if(_===-1)throw new Error(`invalid output '${$}'`);d.push(T),c.push(_)});let p=u.map((y,$)=>Ap(y,()=>`input "${this.inputNames[s[$]]}"`)),f=d.map((y,$)=>y?Ap(y,()=>`output "${this.outputNames[c[$]]}"`):null),g=await Tp(this.sessionId,s,p,c,f,n,i),b={};for(let y=0;y<g.length;y++)b[this.outputNames[c[y]]]=d[y]??Ob(g[y]);return Me(),b}startProfiling(){}endProfiling(){Ip(this.sessionId)}}});var Ep,kp=V(()=>{"use strict";Ep=t=>{if(t?.epContextDataRead)throw new Error('session option "epContextDataRead" is not supported by ONNX Runtime Web')}});var Op={};Ht(Op,{OnnxruntimeWebAssemblyBackend:()=>Pn,initializeFlags:()=>Pp,wasmBackend:()=>Db});var Pp,Pn,Db,Dp=V(()=>{"use strict";Ve();Zo();En();Cp();kp();Pp=()=>{(typeof ve.wasm.initTimeout!="number"||ve.wasm.initTimeout<0)&&(ve.wasm.initTimeout=0);let t=ve.wasm.simd;if(typeof t!="boolean"&&t!==void 0&&t!=="fixed"&&t!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${t}". Reset it to \`false\` and ignore SIMD feature checking.`),ve.wasm.simd=!1),typeof ve.wasm.proxy!="boolean"&&(ve.wasm.proxy=!1),typeof ve.wasm.trace!="boolean"&&(ve.wasm.trace=!1),typeof ve.wasm.numThreads!="number"||!Number.isInteger(ve.wasm.numThreads)||ve.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)ve.wasm.numThreads=1;else{let e=typeof navigator>"u"?to("node:os").cpus().length:navigator.hardwareConcurrency;ve.wasm.numThreads=Math.min(4,Math.ceil((e||1)/2))}},Pn=class{async init(e){Pp(),await bp(),await _p(e)}async createInferenceSessionHandler(e,r){Ep(r);let n=new kn;return await n.loadModel(e,r),n}async createLoraAdapterHandler(e){let r=new er;return await r.loadAdapter(e),r}},Db=new Pn});Ve();Ve();Ve();var $s="1.31.1";var hI=ao;{let t=(Dp(),ar(Op)).wasmBackend;Dt("webgpu",t,5),Dt("webnn",t,5),Dt("cpu",t,10),Dt("wasm",t,10)}Object.defineProperty(ve.versions,"web",{value:$s,enumerable:!0});export{Yf as InferenceSession,Xf as LoraAdapter,Or as TRACE,$t as TRACE_EVENT_BEGIN,xt as TRACE_EVENT_END,Re as TRACE_FUNC_BEGIN,Me as TRACE_FUNC_END,je as Tensor,hI as default,ve as env,Dt as registerBackend};
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
//# sourceMappingURL=ort.bundle.min.mjs.map
