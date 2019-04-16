/// <reference path="../JSBridge.js" />
/// <reference path="../Schema.js" />
/// <reference path="../Enums.js" />
/// <reference path="../Common.js" />
/// <reference path="TravelingCalculations.js" />

var FS = FS || {};

FS.BookableResourceBooking = {
    serverModificationDate: null,
    settingsRequiredForBackgroundSync: null,
    originalRequireSyncLoginSetting: null,
    originalSavePasswordSetting: null,
    bookingBeforeSync: null,
    originalEndTime: null,
    currentFSStatus: null,
    lastTimestampStatus: null,
    localization: null,

    // Static variable to hold defaultBookingCommittedStatus that is retrieved on form load
    // Necessary because onChange event can not set field to a value that has to be fetched async
    defaultBookingCommittedStatus: null,

    bookableResourceBookingOnLoad: function () {
        MobileCRM.Localization.initialize(FS.BookableResourceBooking.storeLocalization, MobileCRM.bridge.alert);
        MobileCRM.UI.EntityForm.onCommand(FS.Common.CustomCommands.customFollowUp, FS.FollowUpWOHelper.FollowUpButton.onButtonClick, true, null);
        MobileCRM.UI.EntityForm.onChange(FS.BookableResourceBooking.handleChange, true, null);
        MobileCRM.UI.EntityForm.onSave(FS.BookableResourceBooking.handleSave, true, null);
        FS.BookableResourceBooking.getDefaultBookingCommittedStatus();
        FS.FollowUpWOHelper.FollowUpButton.setCanCreateWO(null, null);

        MobileCRM.UI.EntityForm.requestObject(function (entityForm) {
            var entityProperties = entityForm && entityForm.entity && entityForm.entity.properties;
            FS.BookableResourceBooking.originalEndTime = entityProperties && entityProperties[FS.Schema.BookableResourceBooking.properties.endTime] || new Date();
            var bookingStatus = entityProperties && entityProperties[FS.Schema.BookableResourceBooking.properties.bookingStatus];
            var isNew = entityForm && entityForm.entity && entityForm.entity.isNew;
            var fStatus = FS.Enums.BookingStatusmsdyn_FieldServiceStatus.Empty;

            if (bookingStatus) {
                MobileCRM.DynamicEntity.loadById(FS.Schema.BookingStatus.name,
                    bookingStatus.id,
                    function (fetchedBookingStatus) {
                        if (fetchedBookingStatus && fetchedBookingStatus.properties) {
                            var currentStatus = fetchedBookingStatus.properties[FS.Schema.BookingStatus.properties.msdyn_fieldServiceStatus];
                            if (!isNew) {
                                fStatus = currentStatus;
                            }
                            FS.TravelingCalculations.populateStatus(currentStatus, true);
                        }
                        FS.BookableResourceBooking.storeBookingStatusFSStatuses(fStatus);
                        MobileCRM.UI.EntityForm.requestObject(
                            function (entityForm) {
                                FS.BookableResourceBooking.setBookingStatusFieldIsEnabled(entityForm); // Needs FS.BookableResourceBooking.currentFSStatus to be initialized
                            },
                            MobileCRM.bridge.alert);
                    }, MobileCRM.bridge.alert);
                FS.TravelingCalculations.populateOldValues(entityForm.entity);
            }

            if (isNew) {
                FS.BookableResourceBooking.storeBookingStatusFSStatuses(fStatus);
                FS.BookableResourceBooking.setBookingStatusFieldIsEnabled(entityForm); // Needs FS.BookableResourceBooking.currentFSStatus to be initialized
                if (entityProperties) {
                    entityProperties[FS.Schema.BookableResourceBooking.properties.msdyn_bookingMethod] = FS.Enums.BookableResourceBookingmsdyn_BookingMethod.Mobile;
                }
            }

            FS.BookableResourceBooking.checkCurrency(entityForm);
        }, MobileCRM.bridge.alert);
    },

    checkCurrency: function (entityForm) {
        var entityProperties = entityForm && entityForm.entity && entityForm.entity.properties;
        var msdynWorkOrder = entityProperties && entityProperties[FS.Schema.BookableResourceBooking.properties.msdyn_workOrder];

        if (msdynWorkOrder) {
            MobileCRM.DynamicEntity.loadById(FS.Schema.WorkOrder.name,
                msdynWorkOrder.id,
                function (workOrder) {
                    MobileCRM.UI.EntityForm.requestObject(function (entityForm) {
                        var entityProperties = entityForm && entityForm.entity && entityForm.entity.properties;

                        var workOrderCurrencyId = workOrder &&
                            workOrder.properties &&
                            workOrder.properties[FS.Schema.WorkOrder.properties.transactionCurrencyId];

                        if (workOrderCurrencyId) {
                            entityProperties[FS.Schema.BookableResourceBooking.properties.transactionCurrencyId] =
                                workOrderCurrencyId;
                        }
                    }, MobileCRM.bridge.alert);
                });
        }
    },

    storeBookingStatusFSStatuses: function (fsStatus) {
        FS.BookableResourceBooking.currentFSStatus = fsStatus;
        FS.BookableResourceBooking.lastTimestampStatus = fsStatus;
    },

    handleChange: function (entityForm) {
        var changedItem = entityForm && entityForm.context && entityForm.context.changedItem;
        var editedEntity = entityForm && entityForm.entity;
        if (changedItem && editedEntity && editedEntity.properties) {
            switch (changedItem) {
                case FS.Schema.BookableResourceBooking.properties.msdyn_workOrder:
                    // Set booking status to default if it is not already set and there is a work order assigned
                    if (FS.BookableResourceBooking.defaultBookingCommittedStatus
                        && !editedEntity.properties[FS.Schema.BookableResourceBooking.properties.bookingStatus]
                        && editedEntity.properties[FS.Schema.BookableResourceBooking.properties.msdyn_workOrder]) {

                        editedEntity.properties[FS.Schema.BookableResourceBooking.properties.bookingStatus] = FS.BookableResourceBooking.defaultBookingCommittedStatus;
                        FS.BookableResourceBooking.handleBookingStatusChange(editedEntity);
                    }
                    FS.BookableResourceBooking.checkCurrency(entityForm);
                    break;
                case FS.Schema.BookableResourceBooking.properties.startTime:
                case FS.Schema.BookableResourceBooking.properties.endTime:
                    FS.BookableResourceBooking.updateDuration(editedEntity);
                    break;
                case FS.Schema.BookableResourceBooking.properties.bookingStatus:
                    FS.BookableResourceBooking.handleBookingStatusChange(editedEntity);
                    break;
                default:
                    break;
            }
        }
    },

    handleBookingStatusChange: function (entity) {
        var bookingStatus = entity && entity.properties && entity.properties[FS.Schema.BookableResourceBooking.properties.bookingStatus];
        if (bookingStatus == null) {
            FS.TravelingCalculations.populateStatus(null, false);
        }
        else {
            MobileCRM.DynamicEntity.loadById(FS.Schema.BookingStatus.name, entity.properties[FS.Schema.BookableResourceBooking.properties.bookingStatus].id,
                function (fetchedStatus) {
                    if (fetchedStatus && fetchedStatus.properties) {
                        var currentStatus = fetchedStatus.properties[FS.Schema.BookingStatus.properties.msdyn_fieldServiceStatus];
                        FS.TravelingCalculations.populateStatus(currentStatus, false);
                        FS.BookableResourceBooking.currentFSStatus = currentStatus;
                        if (currentStatus === FS.Enums.BookingStatusmsdyn_FieldServiceStatus.InProgress
                            || currentStatus === FS.Enums.BookingStatusmsdyn_FieldServiceStatus.Completed) {
                            MobileCRM.UI.EntityForm.requestObject(
                                function (entityForm) {
                                    // if work order status is changing to "In Progress" and "Arrival Time" field is null, we set "Arrival Time" field equal to current date.
                                    if (currentStatus === FS.Enums.BookingStatusmsdyn_FieldServiceStatus.InProgress
                                        && !Boolean(entityForm.entity.properties[FS.Schema.BookableResourceBooking.properties.msdyn_actualArrivalTime])) {
                                        entityForm.entity.properties[FS.Schema.BookableResourceBooking.properties.msdyn_actualArrivalTime] = new Date();
                                    }
                                    // if work order status is changing to "Completed" and "End Time" field is not actual, we set "End Time" field equal to current date.
                                    else if (currentStatus === FS.Enums.BookingStatusmsdyn_FieldServiceStatus.Completed
                                        && (!Boolean(entityForm.entity.properties[FS.Schema.BookableResourceBooking.properties.endTime])
                                            || entityForm.entity.properties[FS.Schema.BookableResourceBooking.properties.endTime].valueOf()
                                            === FS.BookableResourceBooking.originalEndTime.valueOf())) {
                                        entityForm.entity.properties[FS.Schema.BookableResourceBooking.properties.endTime] = new Date();
                                        FS.BookableResourceBooking.updateDuration(entityForm.entity);
                                    }
                                }, MobileCRM.bridge.alert);
                        }
                    }
                }, MobileCRM.bridge.alert, null);
        }
    },

    updateDuration: function (editedEntity) {
        if (!!editedEntity.properties[FS.Schema.BookableResourceBooking.properties.startTime] &&
            !!editedEntity.properties[FS.Schema.BookableResourceBooking.properties.endTime]) {
            var startDate = editedEntity.properties[FS.Schema.BookableResourceBooking.properties.startTime].setSeconds(0, 0);
            var endDate = editedEntity.properties[FS.Schema.BookableResourceBooking.properties.endTime].setSeconds(0, 0);
            var subtractResult = Math.floor((endDate - startDate) / (1000 * 60)); // Convert to minutes

            editedEntity.properties[FS.Schema.BookableResourceBooking.properties.duration] = subtractResult < 0 ? 0 : subtractResult;
        }
    },

    handleSave: function (entityForm) {
        var entity = entityForm && entityForm.entity;
        var bookingStatusId = entity && entity.properties && entity.properties[FS.Schema.BookableResourceBooking.properties.bookingStatus] && entity.properties[FS.Schema.BookableResourceBooking.properties.bookingStatus].id;
        var workOrder = entity && entity.properties && entity.properties[FS.Schema.BookableResourceBooking.properties.msdyn_workOrder];

        FS.TravelingCalculations.populateNewValues(entity);

        // Only allow save for booking with work order if Field Service Status is not empty
        if (workOrder) {
            // If Booking Status has no Field Service Status, result comes back as -1
            if (FS.BookableResourceBooking.currentFSStatus <= 0) {
                entityForm.context.errorMessage = FS.BookableResourceBooking.localization.get("Alert.BookingStatus_FieldServiceStatusMissing");
                // Return true to apply changed values
                return true;
            }
        }

        var errorMessage = FS.TravelingCalculations.runTravelingCalculations(entity);
        if (errorMessage) {
            entityForm.context.errorMessage = errorMessage;
            // Return true to apply changed values
            return true;
        }

        var saveHandler = entityForm.suspendSave();
        MobileCRM.Configuration.requestObject(function (config) {
            if (config && config.isOnline === false) {
                FS.BookableResourceBooking.createBookingTimestamp(entity, saveHandler); // Resumes save
            }
            else {
                saveHandler.resumeSave();
            }
        }, function (error) {
            saveHandler.resumeSave(error);
        });
    },

    setBookingStatusFieldIsEnabled: function (entityForm) {
        var detailView = entityForm.getDetailView(FS.Common.TabNames.BRB_BookingTab);
        var bookingStatusItem = detailView && detailView.getItemByName(FS.Schema.BookableResourceBooking.properties.bookingStatus);
        if (detailView && bookingStatusItem) {
            bookingStatusItem.isEnabled = FS.BookableResourceBooking.currentFSStatus !== FS.Enums.msdyn_bookingtimestampmsdyn_SystemStatus.Completed;
        }
    },

    createBookingTimestamp: function (entity, saveHandler) {
        var workOrder = entity && entity.properties && entity.properties[FS.Schema.BookableResourceBooking.properties.msdyn_workOrder];

        if (workOrder && FS.BookableResourceBooking.lastTimestampStatus !== FS.BookableResourceBooking.currentFSStatus) {
            var bookingReference = new MobileCRM.Reference(entity.entityName, entity.id, entity.primaryName);
            var timestampProperties = {};
            timestampProperties[FS.Schema.BookingTimestamp.properties.msdyn_booking] = bookingReference;
            timestampProperties[FS.Schema.BookingTimestamp.properties.msdyn_systemStatus] = FS.BookableResourceBooking.currentFSStatus;
            timestampProperties[FS.Schema.BookingTimestamp.properties.msdyn_timestampTime] = FS.TravelingCalculations.getCurrentTime();
            timestampProperties[FS.Schema.BookingTimestamp.properties.msdyn_timestampSource] = FS.Enums.msdyn_bookingtimestampmsdyn_TimestampSource.Mobile;
            timestampProperties[FS.Schema.BookingTimestamp.properties.msdyn_generateJournals] = FS.BookableResourceBooking.currentFSStatus === FS.Enums.msdyn_bookingtimestampmsdyn_SystemStatus.Completed;

            var timestamp = MobileCRM.DynamicEntity.createNew(FS.Schema.BookingTimestamp.name, null, null, timestampProperties);

            timestamp.save(
                function (error) {
                    if (error) {
                        saveHandler.resumeSave(error);
                    }
                    else {
                        MobileCRM.UI.EntityForm.requestObject(
                            function (entityForm) {
                                if (entityForm && entityForm.entity && entityForm.entity.properties) {
                                    entityForm.entity.properties[FS.Schema.BookableResourceBooking.properties.msdyn_preventTimestampCreation] = true;
                                }
                                FS.BookableResourceBooking.setBookingStatusFieldIsEnabled(entityForm);
                                saveHandler.resumeSave();
                            },
                            saveHandler.resumeSave);
                    }
                }
            );
        }
        else {
            saveHandler.resumeSave();
        }
    },

    getSettingsForSyncAndHandleServerRecordUpdate: function (config) {
        /// <summary>Get settings for configuration and handle server record update.</summary>
        /// <param name='config' type='MobileCRM.Configuration'>Configuration object.</param>

        // check if Field Service mobile has existing sync error, skip doing background sync.
        if (config.settings.hasSyncErrors) {
            return;
        }

        FS.BookableResourceBooking.originalRequireSyncLoginSetting = config.settings.requireSyncLogin;
        FS.BookableResourceBooking.originalSavePasswordSetting = config.settings.savePassword;
        FS.BookableResourceBooking.checkRequiredSettingsForSync(config);
        // handle server record update
        MobileCRM.UI.EntityForm.requestObject(FS.BookableResourceBooking.handleServerRecordUpdate, FS.BookableResourceBooking.messageBox, null);
    },

    checkRequiredSettingsForSync: function (config) {
        /// <summary>Request settings for configuration.</summary>
        /// <param name='config' type='MobileCRM.Configuration'>Configuration object.</param>

        // the background sync will not work when requireSyncLogin setting is true or savePassword setting is false
        // set settingsRequiredForBackgroundSync = false, otherwise set to true
        if (config.settings.requireSyncLogin || !config.settings.savePassword) {
            FS.BookableResourceBooking.settingsRequiredForBackgroundSync = false;
        } else {
            FS.BookableResourceBooking.settingsRequiredForBackgroundSync = true;
        }
    },

    handleServerRecordUpdate: function (entityForm) {
        /// <summary>Handle the record when it has been updated in the server.</summary>
        /// <param name='entityForm' type='MobileCRM.UI'/>
        var entity = entityForm.entity;
        var fetchEntity = new MobileCRM.FetchXml.Entity(entity.entityName);

        // skip checking the record with the server when user creates a BRB record in the client 
        // before saving where createdon field is undefined
        if (!entity.properties[FS.Schema.BookableResourceBooking.properties.createdOn]) {
            return;
        }

        var primaryKeyName = FS.Schema.BookableResourceBooking.properties.bookableResourceBookingId;
        fetchEntity.addAttribute(primaryKeyName); // id of entity.
        fetchEntity.addAttribute(FS.Schema.BookableResourceBooking.properties.modifiedOn);

        // Set filter to fetch only specific record.
        fetchEntity.filter = new MobileCRM.FetchXml.Filter();
        fetchEntity.filter.where(primaryKeyName, "eq", entity.id);

        var fetch = new MobileCRM.FetchXml.Fetch(fetchEntity);

        // Create a new function for syncOrNotifyUser that uses only 1 parameter
        var syncOrNotifyUserWithEntity = FS.BookableResourceBooking.syncOrNotifyUser.bind(this, entity);

        // do not throw error when there is no network connection, set error callback to null 
        fetch.executeOnline("Array", syncOrNotifyUserWithEntity, null, null);
    },

    syncOrNotifyUser: function (entity, result) {
        /// <summary>Based on different scenarios, the system will synchronize the record between server and the client 
        /// or notify the user that the record has been removed.</summary>
        /// <param name='entity' type='MobileCRM.DynamicEntity'/>
        /// <param name='result' type='Array'>Array of results returned by fetch.executeOnline.</param>
        if (result && result.length > 0) {
            serverModificationDate = new Date(result[0][1]);

            // check to see whether the server side and the client side of the record have a different date and time
            // if not, check to see whether settingsRequiredForBackgroundSync is true or not.
            // if true, do the background sync.
            // if false, set required settings before doing background sync
            if (serverModificationDate.getTime() !== entity.properties[FS.Schema.BookableResourceBooking.properties.modifiedOn].getTime()) {
                FS.BookableResourceBooking.bookingBeforeSync = entity;

                if (FS.BookableResourceBooking.settingsRequiredForBackgroundSync) {
                    FS.BookableResourceBooking.performBackgroundSync();
                } else {
                    FS.BookableResourceBooking.setRequiredSettingsAndSync();
                }
            }
        } else if (entity.properties[FS.Schema.BookableResourceBooking.properties.versionNumber]) {
            // when result.length = 0, it can be the record is created and saved in the client or
            // the record has been removed in the server. When the record is newly created and saved in
            // the client, versionNumber is undefined and we should do nothing. Therefore, when versionNumber
            // has a value, that means the record has been removed in the server, throw an error msg to have
            // user sync the data.
            FS.BookableResourceBooking.messageBox(FS.BookableResourceBooking.localization.get("Alert.RecordHasBeenDeleted"), MobileCRM.UI.EntityForm.closeWithoutSaving);
        }

        return;
    },

    performBackgroundSync: function () {
        /// <summary>Perform background sync.</summary>
        /// <param name='msgBox' type='Object'>messageBox object.</param>

        msgBox = MobileCRM.UI.EntityForm.showPleaseWait(FS.BookableResourceBooking.localization.get("Alert.SyncInProgress"));

        // Register 'SyncFinished' event when synchronization is done.
        MobileCRM.bridge.onGlobalEvent("SyncFinished", FS.BookableResourceBooking.handleSyncFinishEvent.bind(this, msgBox), true, null);

        // Following line initiates the background synchronization if the last synchronization was performed before given Date.
        // It requires "Save password" being active which has been checked beforehand
        MobileCRM.Application.synchronize(true, new Date());
    },

    handleSyncFinishEvent: function (msgBox) {
        /// <summary>event handler when synchronize finishes.</summary>
        /// <param name='msgBox' type='Object'>messageBox object with method close.</param>

        // restore original settings
        var restoreSyncSettings = FS.BookableResourceBooking.setSettings.bind(this, FS.BookableResourceBooking.originalRequireSyncLoginSetting,
            FS.BookableResourceBooking.originalSavePasswordSetting);

        MobileCRM.Configuration.requestObject(restoreSyncSettings, FS.BookableResourceBooking.messageBox);

        // Close 'showPleaseWait' dialog and refresh the form.
        msgBox && msgBox.close();

        // fetch the local BRB entity record after sync and compare with the local BRB record before the sync
        var fetchBRBRecordAfterSync = new MobileCRM.FetchXml.Entity(FS.Schema.BookableResourceBooking.name);
        fetchBRBRecordAfterSync.addAttribute(FS.Schema.BookableResourceBooking.properties.versionNumber);
        fetchBRBRecordAfterSync.filter = new MobileCRM.FetchXml.Filter();
        fetchBRBRecordAfterSync.filter.where(FS.Schema.BookableResourceBooking.properties.bookableResourceBookingId, "eq", FS.BookableResourceBooking.bookingBeforeSync.properties.bookableresourcebookingid);

        var fetch = new MobileCRM.FetchXml.Fetch(fetchBRBRecordAfterSync);

        fetch.executeOffline("Array", function (results) {
            // Only refresh the form when the version number is different between the one before and the one after the sync.
            // This will prevent an infinite loop when there is a sync error and user chooses the option to ignore it. 
            if (results && results.length > 0 && results[0][0] != FS.BookableResourceBooking.bookingBeforeSync.properties.versionnumber) {
                MobileCRM.UI.EntityForm.refreshForm();
            }
        }, null, null);

        // unregister 'SyncFinished' event when synchronization is done.
        MobileCRM.bridge.onGlobalEvent("SyncFinished", null, false);
    },

    setRequiredSettingsAndSync: function () {
        /// <summary>Set required settings, synchronize and reset the settings back to original state.</summary>

        // Create a new function for setRequiredSyncSettings with requireSyncLogin = false, savePassword = true
        var requireSyncLogin = false;
        var savePassword = true;
        var setRequiredSyncSettings = FS.BookableResourceBooking.setSettings.bind(this, requireSyncLogin, savePassword);

        MobileCRM.Configuration.requestObject(setRequiredSyncSettings, FS.BookableResourceBooking.messageBox);

        // wait for 50 ms to make sure all the settings have been changed before calling performBackgroundSync
        setTimeout(FS.BookableResourceBooking.performBackgroundSync, 50);
    },

    setSettings: function (requireSyncLogin, savePassword, config) {
        /// <summary>Set requireSyncLogin and savePassword settings.</summary>
        /// <param name='requireSyncLogin' type='boolean'>requireSyncLogin setting.</param>
        /// <param name='savePassword' type='boolean'>savePassword setting.</param>
        /// <param name='config' type='MobileCRM.Configuration'>Configuration object.</param>

        config.settings.requireSyncLogin = requireSyncLogin;
        config.settings.savePassword = savePassword;

        return true;
    },

    messageBox: function (message, callback) {
        /// <summary>Show message in the message box.</summary>
        /// <param name='message' type='String'>A message.</param>
        /// <param name='callback' type='function(Object)'>Callback that will be executed.</param>
        FS.Common.messageBox(message, [FS.BookableResourceBooking.localization.get("Cmd.Ok")], callback);
    },

    getDefaultBookingCommittedStatus: function () {
        /// <summary>Fetch the defaultBookingCommittedStatus from msdyn_bookingsetupmetadata and store it in a static variable</summary>
        var fetchBookingSetupMetadata = new MobileCRM.FetchXml.Entity(FS.Schema.BookingSetupMetadata.name);
        fetchBookingSetupMetadata.addAttribute(FS.Schema.BookingSetupMetadata.properties.msdyn_defaultBookingCommittedStatus);
        fetchBookingSetupMetadata.filter = new MobileCRM.FetchXml.Filter();
        fetchBookingSetupMetadata.filter.where(FS.Schema.BookingSetupMetadata.properties.msdyn_entityLogicalName, "eq", FS.Schema.BookableResourceBooking.properties.msdyn_workOrder);

        var fetch = new MobileCRM.FetchXml.Fetch(fetchBookingSetupMetadata);

        fetch.execute("Array", function (results) {
            if (results && results.length > 0) {
                FS.BookableResourceBooking.defaultBookingCommittedStatus = results[0][0]; //second 0 is the index of the msdyn_defaultBookingCommittedStatus attribute
            }
        }, MobileCRM.bridge.alert, null);
    },

    storeLocalization: function (localization) {
        FS.BookableResourceBooking.localization = localization;

        // get required settings for synchronize and execute server record update operation
        MobileCRM.Configuration.requestObject(FS.BookableResourceBooking.getSettingsForSyncAndHandleServerRecordUpdate, FS.BookableResourceBooking.messageBox);
    }
};