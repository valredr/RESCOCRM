/// <reference path="../JSBridge.js" />
/// <reference path="../Schema.js" />
/// <reference path="../Enums.js" />
/// <reference path="../Common.js" />

var FS = FS || {};

FS.WorkOrderList = {
    workOrderListOnLoad: function () {
        MobileCRM.UI.EntityList.allowAddExisting = true;    }
};