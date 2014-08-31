var script = document.createElement("script");
script.type = "text/javascript";
script.id = randomString(20,40);
script.innerHTML = "(function(){var f=function MutationObserver(){},sp=Event.prototype.stopPropagation;f.prototype.observe=function(){};Object.defineProperty(window, 'MutationObserver', {value:f,writable:false});Event.prototype.stopPropagation=function stopPropagation(){if(!document.documentElement.hasAttribute('scanning'))sp.apply(this,arguments);};document.documentElement.removeChild(document.getElementById('"+script.id+"'));})()";

document.documentElement.insertBefore(script, document.documentElement.firstChild);