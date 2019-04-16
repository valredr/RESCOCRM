var f1util = {
	logging: 1,
	dumpObject: function (arr, prefix) {
		var dumped_text = "";
		if (!prefix) prefix = "";
			
		if(typeof(arr) == 'object') {
			dumped_text = ""
			for(var item in arr) {
				var value = arr[item];
				
				if(typeof(value) == 'object') { //If it is an array,
					dumped_text += "<br>" + prefix + "" + item + " ["+arr[item]+"]:<br>";
					dumped_text += this.dumpObject(value, prefix + item + ".");
				} else {
					dumped_text += prefix + "" + item + " = \"" + value + "\"<br>";
				}
			}
		} else {
			dumped_text = "->"+arr+" ("+typeof(arr)+")";
		}
		return dumped_text;
	},
	getQueryVariable: function (variable) {
	    var query = window.location.search.substring(1);
	    var vars = query.split("&");
	    for (var i = 0; i < vars.length; i++) {
	        var pair = vars[i].split("=");
	        if (pair[0] == variable) {
	            return pair[1];
	        }
	    }
	    this.writeDebug(variable + ' not found');
	    return null;
	},
	writeDebug: function (text) {
	    var outputDiv = document.getElementById("debugOutput");
	    if (outputDiv == null) {
	        outputDiv = document.createElement("div");
	        outputDiv.id = "debugOutput";
	        document.body.appendChild(outputDiv);
	    }
	    outputDiv.innerHTML += text + "<br><br>";
	},
	clearDebug: function () {
		var outputDiv = document.getElementById("debugOutput");
	    if (outputDiv != null) outputDiv.innerHTML = "";
	}
}
//quick alias functions
f1util.dump = f1util.dumpObject;
f1util.log = f1util.writeDebug;
f1util.clear = f1util.clearDebug;