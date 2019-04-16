window.onload = function (){
	barcodeScan.init();
};

var barcodeScan = {
	workOrderId: null,
	init: function () {
		MobileCRM.UI.EntityForm.requestObject(
            function (entityForm) {       
            	var entity = entityForm.entity;
                var form = entityForm.form;
            	var props = entity.properties;     
            	barcodeScan.workOrderId = props.msdyn_workorderid;

            },
            function (err) {
            	
                MobileCRM.bridge.alert('An error occurred: ' + err);
            }, null
        );
	},
	manualSearch: function() {
		var bc = document.getElementById("bcsearch").value;
		if (bc.length > 0) {
			barcodeScan.search(bc);
		}
	},
	scanExisting: function () {
		MobileCRM.Platform.scanBarCode(function (res) {
			if (!res || res.length <= 0) {
				document.getElementById("scanresult").innerHTML = '<span style="color:red; font-size:12px; font-weight:bold">Barcode not found.</span>';
			} else {
				document.getElementById("scanresult").innerHTML = "";
				barcodeScan.search(res[0]);
			}
		},
		function(err) { MobileCRM.bridge.alert(err); });
	},
	search: function (bc) {
		var entity = new MobileCRM.FetchXml.Entity("msdyn_workorderservicetask");
		entity.addAttribute("msdyn_name");
		entity.addAttribute("msdyn_workorder");
		entity.addAttribute("msdyn_workorderservicetaskid");
		entity.addAttribute("statuscode");
		entity.addAttribute("msdyn_tasktype");
		entity.addAttribute("utc_serviceroutine");
		entity.addAttribute("utc_productserviceroutine");
		entity.addAttribute("msdyn_estimatedduration");

		var linkEntity = entity.addLink("msdyn_customerasset", "msdyn_customerassetid", "msdyn_customerasset", "outer");
		linkEntity.alias = "msdyn_customerasset";
		linkEntity.addAttribute("utc_tag");
		linkEntity.addAttribute("utc_modelnumber");

		var filter = new MobileCRM.FetchXml.Filter();
		filter.where("msdyn_workorder", "eq", this.workOrderId);
		entity.filter = filter;
		var fetch = new MobileCRM.FetchXml.Fetch(entity);
		fetch.execute("JSON", function (res) { barcodeScan.result(res, bc); }, function (err) { MobileCRM.bridge.alert("error: " + err); }, null);
	},
	result: function (res, bc) {

		if (res == null || res.length < 1) {
			document.getElementById("scanresult").innerHTML = '<span style="color:red; font-size:12px; font-weight:bold">Barcode not found.</span>';
			return;
		}
		document.getElementById("scanresult").innerHTML = "";

		var matchingResults = 0;
		var outputString = "";
		var lastGuid = null;

		for(var i=0; i<res.length; i++) {
			var next = res[i];
			var tag = next["msdyn_customerasset.utc_tag"];

			//Partial matches are OK:
			if (typeof(tag) != "string" || tag.indexOf(bc) == -1) {
				continue;
			}

			var guid = next["msdyn_workorderservicetaskid"];			
			var modelNumber = next["msdyn_customerasset.utc_modelnumber"];
			var statusReason = next["statuscode"];
			var taskType = next["msdyn_tasktype"].primaryName;
			var scheduledDuration = next["msdyn_estimatedduration"];
			var displayDuration = "";

			if(scheduledDuration != null) {
				var scheduledDuration = 1500;
				var totalMin = scheduledDuration;
				var hours = parseInt( totalMin / 60 );
				var minutes = parseInt( totalMin ) % 60;
				displayDuration = (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes);
			} else {
				displayDuration = "n/a";
			}

			var PSR = next["utc_productserviceroutine"];
			var PSRName = "None";
			if (PSR && PSR.primaryName)
				PSRName = PSR.primaryName;

			if (!modelNumber)
				modelNumber = "n/a";

			if (!taskType)
				taskType = "n/a";

			outputString += '<table class="task-row" onclick="barcodeScan.loadWOST(\''+guid+'\');"><tbody>';
			outputString += '<tr>';
			outputString += '<td style="width: 50%">Model: '+modelNumber+'</td><td>Barcode: '+tag+'</td>';
			outputString += '</tr>';
			outputString += '<tr>';
			outputString += '<td style="width: 50%">Status: '+statusReason+'</td><td>Type: '+taskType+'</td>';
			outputString += '</tr>';
			outputString += '<tr style="font-size: 11px">';
			outputString += '<td style="width: 50%">Routine: '+PSRName+'</td><td>Duration: '+displayDuration+'</td>';
			outputString += '</tr></tbody>';
			outputString += '</table>';
			outputString += '<div class="spacer">&nbsp;</div>';

			matchingResults++;
			lastGuid = guid;
		}

		if (matchingResults == 0) {
			document.getElementById("scanresult").innerHTML = '<span style="color:red; font-size:12px; font-weight:bold">Barcode not found.</span>';
		} else if (matchingResults == 1) {
			barcodeScan.loadWOST(lastGuid);
		} else {
			document.getElementById("scanresult").innerHTML = outputString;
		}
	},
	loadWOST: function (guid) {
		MobileCRM.UI.FormManager.showDetailDialog("msdyn_workorderservicetask", guid, null);
	}
}