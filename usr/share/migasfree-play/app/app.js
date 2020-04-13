"use strict";

var gui = require("nw.gui");
var path = require("path");
var win = gui.Window.get();
var confFile = "settings.json";
var consoleLog = path.join(gui.__dirname, "console.log");
var toastTime = 3000;
var colorTheme = "#009688"; //teal


function getPython() {
    const execSync = require("child_process").execSync;
    var cmd;

    if (getOS() === "Linux") {
        cmd = '_PYTHON=$(which python2); ' +
            '[ -n "$_PYTHON" ] && $_PYTHON -c "import migasfree_client" 2&> /dev/null || false; ' +
            'if [ $? -ne 0 -o -z "$_PYTHON" ]; then _PYTHON=$(which python3); fi; echo $_PYTHON';
    } else if (getOS() === "Windows") {
        cmd = '';  // TODO
        return 'python';
    }

    return execSync(cmd).toString().replace("\n", "");
}

function getServerVersion() {
    var url = "http://" + global.server + "/api/v1/public/server/info/";
    var err_version = "migasfree-server version 4.16 is required";
    $.support.cors = true;
    $.ajax({
        type: 'HEAD',
        method: 'POST',
        url: url,
        crossDomain: true,
        success: function() {
            // url found
            $.ajax({
                url,
                type: "POST",
                beforeSend: addTokenHeader,
                data: {},
                async: false,
                success(data) {
                    global.serverversion = parseFloat(data.version);
                },
                error(jqXHR, textStatus, errorThrown) {
                    global.serverversion = 0;
                    show_err(err_version);
                },
            });

        },
        error: function(jqXHR, textStatus, errorThrown) {
            // url not found
            global.serverversion = 0;
            show_err(err_version);
        }
    });

}

function getOS() {
    var osName = "Unknown";

    if (navigator.appVersion.indexOf("Win") !== -1) {osName = "Windows";}
    if (navigator.appVersion.indexOf("Mac") !== -1) {osName = "MacOS";}
    if (navigator.appVersion.indexOf("X11") !== -1) {osName = "UNIX";}
    if (navigator.appVersion.indexOf("Linux") !== -1) {osName = "Linux";}

    return osName;
}

function spinner(id) {
    const fs = require("fs");
    $("#" + id).html(fs.readFileSync("templates/spinner.html", "utf8"));
}

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function replaceAll(str, find, replace) {
    var exp = escapeRegExp(find);
    var re = new RegExp(exp, "g");

    return str.replace(re, replace);
}

function replaceColors(txt) {
    txt = replaceAll(txt, "\u001b[92m", "<span class='console-section'>");
    txt = replaceAll(txt, "\u001b[93m", "<span class='console-warning'>");
    txt = replaceAll(txt, "\u001b[91m", "<span class='console-error'>");
    txt = replaceAll(txt, "\u001b[32m", "<span clas='console-info'>");
    txt = replaceAll(txt, "\u001b[0m", "</span>");
    txt = txt.replace(/(?:\r\n|\r|\n)/g, "<br />");

    return txt;
}

function show_err(txt) {
    swal({
        title: "Error",
        text:  txt,
        type: "error",
        confirmButtonColor: colorTheme,
        showCancelButton: false
    });
}


function tooltip(id, text) {
    var anchor = $(id);

    anchor.attr("data-tooltip", text);
    anchor.attr("delay", 100);
    if (id == "#machine") {
        anchor.attr("data-position", "bottom");
    } else {
        anchor.attr("data-position", "left");
    }
    anchor.tooltip();
}


function slugify(name){
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}


function saveTerminal() {
    const fs = require("fs");
    fs.writeFile(consoleLog, JSON.stringify(global.terminal), function (err) {
        if (err) {throw err;}
    });
}


function exit() {
    win.window.close();
}


(function() {
    document.onkeydown = function (e) {
        if (e.keyCode === 116) {  // F5
            e.preventDefault();
            location.reload();
            return false;
        }
    };
}());


gui.Window.get().on("close", function () {
    if (global.running) {
         Materialize.toast(
            "<i class='material-icons'>warning</i>" + _("please wait, other process is running!!!"),
            toastTime,
            "rounded red"
        );
    } else {
        exit();
        gui.App.quit();
    }
});

Array.prototype.diff = function (a) {
    return this.filter(function (i) {return a.indexOf(i) < 0;});
};

function addTokenHeader(xhr) {
     xhr.setRequestHeader("authorization", global.token);
     xhr.setRequestHeader("Accept-Language", global.settings["language"])
}

function labelDone() {
    if (typeof global.label !== "undefined") {
        $("#machine").html(
            "<a class='js-external-link' href='http://{{server}}/admin/server/computer/{{cid}}/change/'>" + global.label["name"] + "</a>"
        );
        tooltip("#machine", _("View computer in migasfree server"));

        var typeNumber = 4;
        var errorCorrectionLevel = "L";
        var qr = qrcode(typeNumber, errorCorrectionLevel);

        qr.addData(
            '{"model":"Computer","id":' + global.label["id"] + ',"server":"' + global.label["server"] + '"}'
        );
        qr.make();

        global.qr = qr;
    }
}


function getToken(username="migasfree-play", password="migasfree-play") {
    $.ajax({
        url: "http://" + global.server + "/token-auth/",
        type: "POST",
        data: {"username": username, "password": password},
        success(data) {
            const fs = require("fs");
            global.token = "token " + data.token;
            fs.writeFileSync("token", data.token);
        },
        error(jqXHR, textStatus, errorThrown) {
            swal({
                title: "Server: " + global.server,
                text: "Token:" + jqXHR.responseText,
                type: "error",
                confirmButtonColor: colorTheme,
                showCancelButton: false
            }).then(
            function () {
                gui.App.quit();
            },
            function (dismiss){
                // dismiss can be 'overlay', 'cancel', 'close', 'esc', 'timer'
                if (dismiss === "cancel") {
                    // nothing
                }
            });
        },
    });
}


function getAttributeCID() {
    if (typeof global.label !== "undefined") {
        $.ajax({
            url: "http://" + global.server + "/api/v1/token/attributes/",
            type: "GET",
            beforeSend: addTokenHeader,
            data: {"property_att__prefix": "CID", "value": global.cid},
            success(data) {
                if (data.count === 1) {
                    global.att_cid = data.results[0].id;
                }
            },
            error(jqXHR, textStatus, errorThrown) {
                show_err(jqXHR.responseText);
            },
        });
    }
}

function saveSettings(settings) {
    const fs = require("fs");
    const path = require("path");
    var filePath = path.join(confFile);

    fs.writeFileSync(filePath, JSON.stringify(settings));
}

function readSettings() {
    const fs = require("fs");
    const path = require("path");
    var filePath = path.join(confFile);

    if (fs.existsSync(filePath)) {
        var data = fs.readFileSync(filePath, "utf8");
        global.settings = JSON.parse(data);
        if (! global.settings.hasOwnProperty('show_menu_apps')) {
            global.settings["show_menu_apps"] = true;
            saveSettings(global.settings);
        }
        if (! global.settings.hasOwnProperty('show_menu_devices')) {
            global.settings["show_menu_devices"] = true;
            saveSettings(global.settings);
        }
        if (! global.settings.hasOwnProperty('show_menu_details')) {
            global.settings["show_menu_details"] = true;
            saveSettings(global.settings);
        }
        if (! global.settings.hasOwnProperty('show_menu_settings')) {
            global.settings["show_menu_settings"] = true;
            saveSettings(global.settings);
        }
        if (! global.settings.hasOwnProperty('show_menu_information')) {
            global.settings["show_menu_information"] = true;
            saveSettings(global.settings);
        }
        if (! global.settings.hasOwnProperty('show_menu_help')) {
            global.settings["show_menu_help"] = true;
            saveSettings(global.settings);
        }
    }
    else {
        global.settings = {};
        global.settings["language"] = "es";
        global.settings["theme"] = "dark";
        global.settings["show_details_to_sync"] = false;
        global.settings["show_menu_apps"] = true;
        global.settings["show_menu_devices"] = true;
        global.settings["show_menu_details"] = true;
        global.settings["show_menu_settings"] = true;
        global.settings["show_menu_information"] = true;
        global.settings["show_menu_help"] = true;

        saveSettings(global.settings);
    }
    loadLocale(global.settings["language"]);
}

function getPkgNames() {
    const execSync = require("child_process").execSync;
    var packages = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client.client import MigasFreeClient; print(MigasFreeClient().pms.available_packages(), end=\'\')"').toString();
    packages = replaceAll(packages, "'", '"');
    return JSON.parse(packages);
}

function execDir(directory) {
    const execSync = require("child_process").execSync;
    const fs = require("fs");
    const path = require("path");

    try {
        fs.accessSync(directory);
    } catch (e) {
        return;
    }

    var files = fs.readdirSync(directory);
    for (var i in files) {
        global.TERMINAL.add(execSync(path.join(directory, files[i])));
    }
}


function beforeSync() {
    Materialize.toast(_("synchronizing..."), toastTime, "rounded grey");
}


function afterSync() {
    global.pks_availables = getPkgNames();
    Materialize.toast(
        "<i class='material-icons'>play_arrow</i>" + _("synchronized"),
        toastTime,
        "rounded green"
    );
    global.sync = false;
}


function sync_each_24() {
    setTimeout(sync_each_24, 24*60*60*1000);
    sync();
}

function renderRun(idx) {
    const fs = require("fs");

    var data = {
        id: idx,
        date: global.terminal[idx]["date"],
        icon: global.terminal[idx]["icon"],
        header: global.terminal[idx]["header"],
        body: global.terminal[idx]["body"]
    };

    return Mustache.to_html(fs.readFileSync("templates/run.html", "utf8"), data);
}

function sync() {
    global.TERMINAL.run("migasfree -u", beforeSync, afterSync, "sync", _("synchronization"));
}

function showDetails() {
    const fs = require("fs");
    $("#container").html(fs.readFileSync("templates/details.html", "utf8"));
    global.TERMINAL.refresh();
}

function runAsUserSync(cmd) {
    const execSync = require("child_process").execSync;

    if (getOS() === "Linux") {
        cmd = replaceAll(cmd, '"' , '\\\"');
        execSync('sudo su -c "' + cmd + '" ' + global.user);
    } else if (getOS() === "Windows") {
        execSync(cmd);
    }
}

function runAsUser(cmd) {
    const exec = require("child_process").exec;

    if (getOS() === "Linux") {
        cmd = replaceAll(cmd, '"', '\\\"');
        exec('sudo su -c "' + cmd + '" ' + global.user);
    } else if (getOS() === "Windows") {
        exec(cmd);
    }
}

function supportExternalLinks(event) {
    var href;
    var isExternal = false;

    function crawlDom(element) {
        if (element.nodeName.toLowerCase() === "a") {
            href = element.getAttribute("href");
        }
        if (element.classList.contains("js-external-link")) {
            isExternal = true;
        }
        if (href && isExternal) {
            event.preventDefault();
            var data = {
                "server": global.server,
                "cid":  global.label["id"],
                "computer": global.label["name"],
                "project": global.project,
                "uuid": global.uuid
            };
            href = Mustache.render(href, data);
            runAsUser(global.python + ' -c "import webbrowser; webbrowser.open(\'' + href + '\')"');
        } else if (element.parentElement) {
            crawlDom(element.parentElement);
        }
    }

    crawlDom(event.target);
}

// DEVICES
function queryDevicesPage(url) {
    $.ajax({
        url,
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
            showDeviceItem(data);
            if (data.next) {
                var options = [{
                    selector: "footer",
                    offset: 0,
                    callback() {
                        if (data.next) {
                            queryDevicesPage(data.next);
                        }
                    }
                }];
                Materialize.scrollFire(options);
            } else {
                $("#preload-next").hide();
            }
        },
        error(jqXHR, textStatus, errorThrown) {
            show_err(jqXHR.responseText);
        },
    });
}

function queryDevices() {
    $("#devices").html("");
    $("#preload-next").show();
    spinner("preload-next");
    getDevs();
    queryDevicesPage(
        "http://" + global.server + "/api/v1/token/devices/devices/available/" +
        "?cid=" +  global.label["id"] + "&q=" + global.searchPrint
    );
}

function changeAttributesDevice(dev, feature, id, atts) {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/devices/logical/" + id + "/",
        type: "PATCH",
        beforeSend: addTokenHeader,
        contentType: "application/json",
        data: JSON.stringify({"attributes": atts}),
        success(data) {
           getDevs();
           updateStatusDevice(dev, feature, id);
        },
        error(jqXHR, textStatus, errorThrown) {
            show_err("changeAttributesDevice:" + jqXHR.responseText);
        },
    });
}

function installDevice(dev, feature, id) {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/devices/logical/" + id + "/",
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
            var atts =  data.attributes;
            atts.push(global.att_cid);
            changeAttributesDevice(dev, feature, id, atts);
        },
        error(jqXHR, textStatus, errorThrown) {
            show_err(jqXHR.responseText);
        },
    });
}

function uninstallDevice(dev, feature, id) {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/devices/logical/" + id + "/",
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
            var atts =  data.attributes;
            //delete attribute from array
            var index = atts.indexOf(global.att_cid);
            if (index > -1) {
                atts.splice(index, 1);
            }

            changeAttributesDevice(dev, feature, id, atts);
        },
        error(jqXHR, textStatus, errorThrown) {
            show_err(jqXHR.responseText);
        },
    });
}

function updateStatusDevice(dev, feature, id) {
    dev=slugify(dev);
    feature=slugify(feature);
    var slug = dev + feature;
    var el = "#action-" + slug;
    var status = "#status-action-" + slug;
    var assigned = ($.inArray(id, global.devs) >= 0);
    var inflicted = ($.inArray(id, global.inflicted) >= 0);

    if (global.only_devs_assigned) {
        if (assigned || inflicted){
            $("#dev-"+dev).removeClass("hide");
            $("#logical-action-"+slug).removeClass("hide");

        } else {
            $("#logical-action-"+slug).addClass("hide");
        }
    } else {
        $("#dev-"+dev).removeClass("hide");
        $("#logical-action-"+slug).removeClass("hide");
    }

    try {
        if (assigned) {
            $(el).text("delete");
            $(el).off("click");
            $(el).click(function() {uninstallDevice(dev, feature, id);});
            $(status).text(_("assigned"));
            $(status).removeClass("hide");
        } else if (inflicted) {
            $(el).addClass("hide");
            $(status).removeClass("hide");
            $(status).text(_("inflicted"));
        } else {
            $(el).text("get_app");
            $(el).off("click");
            $(el).click(function() {installDevice(dev, feature, id);});
            $(status).text("");
            $(status).addClass("hide");
        }
    }
    catch (err){
        // nothing
    }
}

function renderDict(data) {
    var ret= "";

    for (var element in data) {
        ret+= element + ": " + data[element] + "<br />";
    }
    return ret;
}


function deleteEmptyElement(obj) {
    for (const prop in obj) {
        if (! obj[prop]) {
            delete obj[prop];
        }
    }
}


function renderInfoDevice(data) {
    return renderDict(JSON.parse(data));
}

function renderDevice(dev) {
    const fs = require("fs");
    var icon;

    if (dev.connection.name === "TCP") {
        icon = "assets/printer-net.png";
    } else {
        icon = "assets/printer-local.png";
    }

    var datavar = JSON.parse(dev.data);
    var location = "";
    if (datavar.LOCATION) {
        location = datavar.LOCATION;
        delete datavar["LOCATION"];
    }

    deleteEmptyElement(datavar);

    if (datavar.NAME) {
        var name = datavar.NAME;
        datavar.MODEL = dev.model.manufacturer.name + " " + dev.model.name;
        delete datavar["NAME"];
    } else {
        var name = dev.model.manufacturer.name + " " + dev.model.name;
    }

    var data = {
        id: dev.name,
        name: name,
        idaction: "dev-" + slugify(dev.name),
        icon,
        details: renderDict(datavar),
        truncated: location,
        connection: dev.connection.name
    };

    return Mustache.to_html(fs.readFileSync("templates/device.html", "utf8"), data);
}


function renderLogical(logical) {
    const fs = require("fs");

    var name = logical.feature.name;
    if (logical.alternative_feature_name) {
        name = logical.alternative_feature_name;
    }

    var data = {
        name: name,
        idaction: "action-" + slugify(logical.device.name + logical.feature.name),
    };
    return Mustache.to_html(fs.readFileSync("templates/logical.html", "utf8"), data);
}


function getDevice(dev) {
    $("#devices").append(renderDevice(dev));
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/devices/logical/available/?cid=" + global.cid.toString() + "&did=" + dev.id,
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(logicalDevs) {
            $.each(logicalDevs.results, function(i, logical) {
                $("#logicals-dev-" + slugify(logical.device.name)).append(renderLogical(logical));
                updateStatusDevice(
                    logical.device.name, logical.feature.name,
                    logical.id
                );
            });
        },
        error(jqXHR, textStatus, errorThrown) {
            show_err(jqXHR.responseText);
        },
    });
}

function showDeviceItem(data) {
    $.each(data.results, function(i, item) {
        getDevice(item);
    });
    $(".collapsible").collapsible();  // FIXME
}


// APPS
function showCategories(categories) {
    $.each(categories, function(key, value) {
        $("#categories").append(
            $("<option>", {value: key}).text(value)
        );
    });
    $("#categories").val(global.category);
    $("#categories").material_select();
}

function queryCategories() {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/catalog/apps/categories/",
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
           global.categories = data;
           global.categories[0] = _("All");
           showCategories(global.categories);
        },
        error(jqXHR, textStatus, errorThrown) {
            show_err(jqXHR.responseText);
        },
    });
}

function installedPkgs(pks) {
    const path = require("path");
    const execSync = require("child_process").execSync;
    var script = '"' + path.join(gui.__dirname, "py", "installed.py") + '"';
    var cmd = global.python + " " + script + ' "' + pks + '"';
    return execSync(cmd);
}

function queryAppsPage(url) {
  if (global.flag_apps) {
    global.flag_apps = false;
    $.ajax({
        url,
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        success(data) {
            $.each(data.results, function(i, item) {
                $.each(item.packages_by_project, function(i, pkgs) {
                    if (pkgs.project.name == global.project) {
                        global.packages += " " + pkgs.packages_to_install.join(" ");
                    }
                });
            });

            global.packagesInstalled = installedPkgs(global.packages);

            showAppItem(data);

            if (data.next) {
                var options = [{
                    selector: "footer",
                    offset: 0,
                    callback() {
                        if (data.next) {
                            queryAppsPage(data.next);
                        }
                    }
                }];
                Materialize.scrollFire(options);
            } else {
                $("#preload-next").hide();
            }
            global.flag_apps = true;
        },
        error(jqXHR, textStatus, errorThrown) {
            show_err(jqXHR.responseText);
        },
    });
  }
}

function queryApps() {
    $("#apps").html("");
    $("#preload-next").show();
    global.packages = "";

    var url = "";
    var categoryFilter = "";
    if (global.category != 0) {
        categoryFilter = "&category=" + global.category;
    }

    spinner("preload-next");

    if (global.serverversion >= 4.16) {
        url = "http://" + global.server + "/api/v1/token/catalog/apps/available/"
    } else {
        url = "http://" + global.server + "/api/v1/token/catalog/apps/"
    }

    queryAppsPage(
        url +
        "?cid=" +  global.label["id"] +
        "&q=" + global.search +
        categoryFilter
    );
}


function renderRating(score) {
    var rating = "";

    for (var i = 0; i < score; i++) {
        rating += "<i class='material-icons tiny md-12'>star</i>";
    }
    for (var j = score; j < 5; j++) {
        rating += "<i class='material-icons tiny md-12 blue-grey-text text-lighten-4'>star</i>";
    }

    return rating;
}

function renderApp(item) {
    const fs = require("fs");
    const marked = require("marked");

    var renderer = new marked.Renderer();

    renderer.heading = function (text, level) {
        var escapedText = text.toLowerCase().replace(/[^\w]+/g, "-");
        return "<h" + (level + 3) + "><a name='" +
             escapedText +
             "' class='anchor' href='#" +
             escapedText + "'></a><span>" + text +
             "</span></h" + (level + 3) + ">";
    };

    var data;
    var truncatedDesc = "";
    if (item.description) {
        truncatedDesc = item.description.split("\n")[0];

        data = {
            server: global.server,
            cid: global.label["id"],
            computer: global.label["name"],
            project: global.project,
            uuid: global.uuid,
            app: item.name,
            _app: slugify(item.name)
        };
        item.description = Mustache.render(item.description, data);
    }

    data = {
        name: item.name,
        idaction: "action-" + slugify(item.name),
        icon: item.icon,
        description: marked(item.description, {renderer: renderer}),
        truncated: truncatedDesc,
        category: item.category.name,
        rating: renderRating(item.score),
        txt_installed: _("installed"),
        exists_title: (truncatedDesc),
        exists_description: item.description.split("\n").length > 1
    };

    return Mustache.to_html(fs.readFileSync("templates/app.html", "utf8"), data);
}


function showAppItem(data) {
    $.each(data.results, function(i, item) {
        if (item.category.id == global.category || global.category == 0) {
            $.each(item.packages_by_project, function(i, pkgs) {
                if (pkgs.project.name == global.project) {
                    $("#apps").append(renderApp(item));
                    updateStatus(
                        item.name,
                        pkgs.packages_to_install.join(" "),
                        item.level.id
                    );
                }
            });
        }
    });
    $(".collapsible").collapsible();  // FIXME
}

function showDescription(id) {
    $("#trunc-" + id).hide();
    $("#descr-" + id).show();
}

function showTruncated(id) {
    $("#descr-" + id).hide();
    $("#trunc-" + id).show();
}

function changedCategory() {
    global.category = $("#categories").val();
    queryApps();
}


function changed_only_apps_installed(){
    global.only_apps_installed = $("#only_apps_installed").prop('checked');
    queryApps();
}

function changed_only_devs_assigned(){
    global.only_devs_assigned = $("#only_devs_assigned").prop('checked');
    queryDevices();
}


function getChar(event) {
    var keyCode = ("which" in event) ? event.which : event.keyCode;

    if (keyCode === 13) {  // Enter
        global.search = $("#search").val();
        queryApps();
    }
}

function getCharPrint(event){
    var keyCode = ("which" in event) ? event.which : event.keyCode;

    if (keyCode === 13) {  // Enter
        global.searchPrint = $("#searchPrint").val();
        queryDevices();
    }
}


function getDevs() {
    $.ajax({
        url: "http://" + global.server + "/api/v1/token/computers/"+global.cid+"/devices/",
        type: "GET",
        beforeSend: addTokenHeader,
        data: {},
        async: false,
        success(data) {
            global.devs = [];
            global.inflicted = [];
            data.assigned_logical_devices_to_cid.forEach( function(item) {
                global.devs.push(item.id);
            } );
            data.inflicted_logical_devices.forEach( function(item) {
                global.inflicted.push(item.id);
            } );
        },
        error(jqXHR, textStatus, errorThrown) {
            show_err(jqXHR.responseText);
        },
    });
}


function showDevices() {
    const fs = require("fs");

    var data = {
        txt_search: _("search"),
        txt_assigned: _("assigned")
    };

    $("#container").html( Mustache.to_html(fs.readFileSync("templates/devices.html", "utf8"), data) );

    spinner("devices");
    $("#only_devs_assigned").prop('checked', global.only_devs_assigned);

    queryDevices();

    $("#searchPrint").val(global.searchPrint);
    $("#searchPrint").bind("keydown", getCharPrint);
    $("#searchPrint").focus();

    $("#only_devs_assigned").change(changed_only_devs_assigned);
}

function showApps() {
    const fs = require("fs");

    queryCategories();
    var data = {
        txt_search: _("search"),
        txt_installed: _("installed")
    };

    $("#container").html( Mustache.to_html(fs.readFileSync("templates/apps.html", "utf8"), data) );
    spinner("apps");
    $("#only_apps_installed").prop('checked', global.only_apps_installed);

    queryApps();

    $("#categories").change(changedCategory);
    $("#search").val(global.search);
    $("#search").bind("keydown", getChar);
    $("#search").focus();

    $("#only_apps_installed").change(changed_only_apps_installed);
}


function renderTag(tag) {
    const fs = require("fs");
    var data = {
        tag: tag
    };
    return Mustache.to_html(fs.readFileSync("templates/tag.html", "utf8"), data);
}


function onDemand(application) {
    swal({
        title: application + " " + _("no available"),
        html: global.label["helpdesk"] + "<br />" + global.label["name"],
        type: "warning",
        showCancelButton: false,
        confirmButtonColor: colorTheme
    }, function() {
    });
}

// PMS
function postAction(name, pkgs, level) {
    global.packagesInstalled = installedPkgs(global.packages);
    if (pkgs.split(" ").diff(global.packagesInstalled).length == 0) {
        Materialize.toast(
            "<i class='material-icons'>get_app</i> " + _("{{name}} installed", {name: name}),
            toastTime,
            "rounded green"
        );
    }
    else {
        Materialize.toast(
            "<i class='material-icons'>delete</i> " + _("{{name}} deleted", {name: name}),
            toastTime,
            "rounded green"
        );
    }
    updateStatus(name, pkgs, level);
}

function install(name, pkgs, level) {
    Materialize.toast(_("installing {{name}}...", {name: name}), toastTime, "rounded grey");
    var cmd;
    if (getOS() === "Linux") {
        cmd = 'LANG_ALL=C echo "y"|migasfree -ip "' + pkgs + '"';
    } else if (getOS() === "Windows") {
        cmd = 'migasfree -ip "' + pkgs + '"';
    }
    global.TERMINAL.run(
        cmd,
        null,
        function() {postAction(name, pkgs, level);},
        "action-" + slugify(name),
        name
    );
}

function uninstall(name, pkgs, level) {
    Materialize.toast(_("deleting {{name}}...", {name: name}), toastTime, "rounded grey");
    var cmd;
    if (getOS() === "Linux") {
        cmd = 'LANG_ALL=C echo "y"|migasfree -rp "' + pkgs + '"';
    } else if (getOS() === "Windows") {
        cmd = 'migasfree -rp "' + pkgs + '"';
    }
    global.TERMINAL.run(
        cmd,
        null,
        function() {postAction(name, pkgs, level);},
        "action-" + slugify(name),
        name
    );
}

function updateStatus(name, packagesToInstall, level) {
    var slug = slugify(name);
    var el = "#action-" + slug;
    var status = "#status-action-" + slug;
    var descr = "#description-action-" + slug;
    var installed;

    if (packagesToInstall == "") {
        installed = false;
    } else {
        installed = (packagesToInstall.split(" ").diff(global.packagesInstalled).length === 0);
    }

    if (global.only_apps_installed && (installed == false)){
        $("#card-action-"+slug).addClass("hide");
    } else {
        $("#card-action-"+slug).removeClass("hide");
    }

    try {
        if (packagesToInstall.split(" ").diff(global.pks_availables) == "") {  // AVAILABLE
            var person = "";
            if ($("#auth").text() === "" && level === "A") {  // NO LOGIN
                $(el).text("person");
                $(el).off("click");
                $(el).click(function() {modalLogin(name, packagesToInstall, level);});
                if (installed) {
                    $(status).removeClass("hide");
                    $(descr).off("click");
                    $(descr).click(function() {modalLogin(name, packagesToInstall, level);});
                } else {
                    $(status).addClass("hide");
                }
            } else {
                if (installed) {
                    $(el).text("delete");
                    $(el).off("click");
                    $(el).click(function() {uninstall(name, packagesToInstall, level);});
                    $(status).removeClass("hide");
                } else {
                    if (packagesToInstall != "") {
                        $(el).text("get_app");
                        $(el).off("click");
                        $(el).click(function() {install(name, packagesToInstall, level);});
                        $(status).addClass("hide");
                    }
                }
            }
        } else {  // IS NOT AVAILABLE
            $(el).text("lock_open");
            $(el).off("click");
            $(el).click(function() {onDemand(name);});
        }
    }
    catch(err) {
        // nothing
    }
}

// LABEL
function printLabel() {
    window.print();
}

function showLabel() {
    const fs = require("fs");
    const pk = require('./package.json');
    var data = {
        "server": global.server,
        "app_name": pk.name,
        "app_version": pk.version,
        "app_description": _(pk.description),
        "app_copyright": pk.copyright,
        "app_author": pk.author,
        "cid":  global.label["id"],
        "name": global.label["name"],
        "project": global.project,
        "user": global.user,
        "uuid": global.uuid,
        "helpdesk": global.label["helpdesk"],
        "ip": global.ip,
        "mask": global.mask,
        "network": global.network,
        "computer": global.computer,
        "txt_status": _(global.computer.status),
        "qrcode": Mustache.to_html(
            fs.readFileSync("templates/qrcode.html", "utf8"),
            {"qrcode": global.qr.createImgTag(2, 2)}
        ),
        "qrcode2": Mustache.to_html(
            fs.readFileSync("templates/qrcode2.html", "utf8"),
            {"qrcode": global.qr.createImgTag(3, 3)}
        )
    };

    $("#container").html(Mustache.to_html(fs.readFileSync("templates/information.html", "utf8"), data));

    global.computer.tags.forEach( function(tag) {
        $("#tags").append(renderTag(tag));
    } );

    $("#print-label").click(printLabel);

    labelDone();
}

function checkUser(user, password) {
    var path = require("path");
    var script = '"' + path.join(gui.__dirname, "py", "check_user.py") + '"';
    var execSync = require("child_process").execSync;

    try {
        process.env._LOGIN_MP_USER = user;
        process.env._LOGIN_MP_PASS = password;
        execSync(global.python + " " + script);
        process.env._LOGIN_MP_USER = "";
        process.env._LOGIN_MP_PASS = "";
        $("#auth").text("yes");
        return true;
    }
    catch(err) {
        $("#auth").text("");

        swal({
            title: _("Cancelled"),
            html: _("Autentication error"),
            type: "error",
            showCancelButton: false,
            confirmButtonText: "OK",
            confirmButtonColor: colorTheme
        }).then(
            function () {},
            function (dismiss){
                // dismiss can be 'overlay', 'cancel', 'close', 'esc', 'timer'
                if (dismiss === "cancel") {
                    // nothing
                }
        });
        return false;
    }
}


// I18N
function loadLocale(locale) {
    const fs = require("fs");
    const path = require("path");
    var filePath = path.join(".", "app", "locales", locale + ".json");
    if (fs.existsSync(filePath)) {
        var data = fs.readFileSync(filePath, "utf8");
        global.strings = JSON.parse(data);
    }
}

function _(txt,data = {}) {
    if ( !(typeof global.strings === "undefined") &&  global.strings.hasOwnProperty(txt)) {
        return Mustache.render(global.strings[txt], data);
    } else {
        return Mustache.render(txt, data);
    }
}


// SETTINGS
function getSettings() {
    global.settings["language"] = $("#language").val();
    global.settings["theme"] = "dark";
    global.settings["show_details_to_sync"] = $("#show_details_to_sync").is(":checked");
}

function setSettings() {
    $("#show_details_to_sync").prop("checked", global.settings["show_details_to_sync"]);
    $("#language").val(global.settings["language"]);
}

function showSettings() {
    const fs = require("fs");
    const ISO6391 = require('iso-639-1');
    var data = {
        txt_synchronize: _("Show details to synchronize")
    };

    $("#container").html( Mustache.to_html(fs.readFileSync("templates/settings.html", "utf8"), data) );

    setSettings();

    $("#show_details_to_sync").change(function() {
        getSettings();
        saveSettings(global.settings);
    });

    $('#language').append($('<option>', {
        value: "en",
        text: 'English'
    }));

    fs.readdirSync("app/locales").forEach(file => {
          var code = file.split('.').slice(0, -1).join('.');
          $("#language").append(
            $("<option>", {
                value: code,
                text: ISO6391.getNativeName(code)
            })
          );
    });

    $("#language").val(global.settings["language"]);
    $("#language").material_select();

    $("#language").change(function() {
        getSettings();
        saveSettings(global.settings);
    });
}

function modalLogin(name, packagesToInstall, level) {
    const fs = require("fs");
    var resolve = [];
    swal({
        title: _("administrator"),
        html: fs.readFileSync("templates/login.html", "utf8"),
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: colorTheme,
        preConfirm() {
            resolve=[$("#user").val(), $("#password").val()];
        }
    }).then(function (result) {
        if (checkUser(resolve[0], resolve[1])) {
            updateStatus(name, packagesToInstall, level);
        }
    }).catch(swal.noop);
}


function loadTerminal() {
    if (! global.sync) {
        $.each(global.terminal, function(i, term) {
           $("#console").append(renderRun(i));
        });
    }
    if (global.idx) {
        $('.collapsible').collapsible();
        $('#console > li:nth-child(' + global.idx + ') > div.collapsible-header').click();
        window.scrollTo(0,document.body.scrollHeight);
    }
}


function padLeft(nr, n, str){
    return Array(n-String(nr).length+1).join(str||'0')+nr;
}

function formatDate(date) {
    return date.getFullYear()+ "/" + padLeft(parseInt(date.getMonth())+1,2) + "/" + padLeft(parseInt(date.getDate()),2) + "  " + padLeft(parseInt(date.getHours()),2) +":" + padLeft(parseInt(date.getMinutes()),2)+":"+ padLeft(parseInt(date.getSeconds()),2);
}

function getGlobalData() {
    const execSync = require("child_process").execSync;
    const fs = require("fs");
    const path = require("path");
    var myArgs = gui.App.argv;

    global.python = getPython();
    
    if (typeof global.search === "undefined") {
        global.search = "";
    }

    if (typeof global.searchPrint === "undefined") {
        global.searchPrint = "";
    }

    readSettings();
    global.running = false;

    global.TERMINAL = (function() {
        if (typeof global.terminal == "undefined") {
            global.terminal = {};
        }
        var stderr = "";

        function addToStdErr(txt) {
            stderr += txt;
        }

        return {
            add(txt) {
                try {
                    global.terminal[global.run_idx]["body"] = replaceColors(global.terminal[global.run_idx]["body"] + txt);
                    this.refresh();
                }
                catch(err) {
                    // nothing
                }
            },
            refresh() {
                 try {
                     $("#" + global.run_idx).html(global.terminal[global.run_idx]["body"]);
                     if ($('#console').length > 0) {
                         if ( $('#console > li:nth-child(' + global.idx + ') > div.collapsible-body').attr("style")!=="display: none;") {
                             window.scrollTo(0,document.body.scrollHeight);
                         }
                     }
                 }
                 catch(err) {
                    // nothing
                 }
            },
            run(cmd, beforeCallback=null, afterCallback=null, id, txt) {
                if (global.running) {
                    Materialize.toast(
                        "<i class='material-icons'>warning</i>" + _("please wait, other process is running!!!"),
                        toastTime,
                        "rounded red"
                    );
                }
                else {
                    global.running = true;

                    $("#" + id).addClass("blink");

                    if (beforeCallback) {
                        beforeCallback();
                    }

                    var spawn = require("child_process").spawn;
                    var process;

                    if (getOS() === "Linux") {
                        process = spawn("bash", ["-c", cmd]);
                    } else if (getOS() === "Windows") {
                        process = spawn("cmd", ["/C", cmd]);
                    }

                    var date = new Date();

                    global.idx = global.idx + 1;
                    global.run_idx = "_run_" + (global.idx).toString();
                    global.terminal[global.run_idx] = {
                        "icon": $("#" + id).text(), 
                        "date": formatDate(date), 
                        "header": txt, 
                        "body": ""
                    };

                    $("#console").append(renderRun(global.run_idx));
                    $('#console > li:nth-child(' + global.idx + ') > div.collapsible-header').click();

                    process.stdout.on("data", function(data) {global.TERMINAL.add(data.toString());});

                    process.stderr.on("data", function(data) {
                        addToStdErr(data.toString());
                        global.TERMINAL.add("<span class='red'>" + data.toString() + "</span>");
                    });

                    // when the spawn child process exits, check if there were any errors
                    process.on("exit", function(code) {
                        if (code !== 0) {  // Syntax error
                            Materialize.toast(
                                "<i class='material-icons'>error</i> error:" + code + " " + cmd,
                                toastTime,
                                "rounded red"
                            );
                            win.show();
                        }
                        else {
                            if (stderr === "") {
                                if (afterCallback) {
                                    afterCallback();
                                }

                                if (id == "sync" &&  document.hidden) {  // sync ok & minimized -> exit
                                    exit();
                                }
                            }
                            else {
                                Materialize.toast(
                                    "<i class='material-icons'>error</i>" + replaceColors(stderr),
                                    toastTime,
                                    "rounded red"
                                );
                                stderr = "";
                            }
                        }

                        global.TERMINAL.add("<hr />");

                        $("#" + id).removeClass("blink");

                        saveTerminal();

                        global.running = false;
                    });
                }
            }
        };
    }());

    if (typeof global.sync === "undefined") {
        global.sync = (myArgs == "sync");
    }

    if (typeof global.conf === "undefined") {
        global.conf = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client import settings; print(settings.CONF_FILE, end=\'\')"');
    }

    if (typeof global.server === "undefined") {
        global.server = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client.utils import get_config; print(get_config(\'' + global.conf + '\', \'client\').get(\'server\', \'localhost\'), end=\'\')"');
    }

    if (typeof global.token === "undefined") {
        var tokenfile =  path.join(process.cwd(), "token");
        if (fs.existsSync(tokenfile)) {
            global.token = "token " + fs.readFileSync(tokenfile, "utf8");
        } else {
            getToken();
        }
    }

    if (typeof global.uuid === "undefined") {
        global.uuid = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client.utils import get_hardware_uuid; print(get_hardware_uuid(), end=\'\')"');
    }

    if (typeof global.project === "undefined") {
        global.project = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client.utils import get_mfc_project; print(get_mfc_project(), end=\'\')"');
    }

    if (typeof global.computername === "undefined") {
        global.computername = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client.utils import get_mfc_computer_name; print(get_mfc_computer_name(), end=\'\')"');
    }

    if (typeof global.network === "undefined") {
        global.network = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client.network import get_iface_net, get_iface_cidr, get_ifname; _ifname = get_ifname(); print(\'%s/%s\' % (get_iface_net(_ifname), get_iface_cidr(_ifname)), end=\'\')"');
    }

    if (typeof global.mask === "undefined") {
        global.mask = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client.network import get_iface_mask, get_ifname; _ifname = get_ifname(); print(get_iface_mask(_ifname), end=\'\')"');
    }

    if (typeof global.ip === "undefined") {
        global.ip = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client.network import get_iface_address, get_ifname; _ifname = get_ifname(); print(get_iface_address(_ifname), end=\'\')"');
    }

    if (typeof global.user === "undefined") {
        global.user = execSync(global.python + ' -c "from __future__ import print_function; from migasfree_client import utils; _graphic_pid, _graphic_process = utils.get_graphic_pid(); print(utils.get_graphic_user(_graphic_pid), end=\'\')"');
    }

    if (typeof global.serverversion === "undefined") {
        getServerVersion();
    }

    global.flag_apps = true;

    // LABEL
    $.getJSON(
        "http://" + global.server + "/get_computer_info/?uuid=" + global.uuid,
        {}
    ).done(function( data ) {
        global.label = data;
        global.cid = global.label["id"];
        getAttributeCID();
        $.ajax({
            url: "http://" + global.server + "/api/v1/token/computers/?id="+global.cid,
            type: "GET",
            beforeSend: addTokenHeader,
            data: {},
            success(data) {
                if (data.count === 1) {
                    global.computer = data.results[0];
                    global.computer.ram = (global.computer.ram/1024/1024/1024).toFixed(1)+ " GB";
                    global.computer.storage = (global.computer.storage/1024/1024/1024).toFixed(1) + " GB";
                    if (global.computer.machine = "V") {
                        global.computer.machine = "(virtual)" ;
                    } else {
                        global.computer.machine="" ;
                    }

                    labelDone();

                    if (! global.sync) {
                        if (global.settings["show_menu_apps"]) {
                            showApps();
                        } else if (global.settings["show_menu_devices"]) {
                            showDevices();
                        } else {
                            showDetails();
                        }
                    }

                }
            },
            error(jqXHR, textStatus, errorThrown) {
                show_err(jqXHR.responseText);
            },
        });

    });

    if (typeof global.category === "undefined") {
        global.category = 0;
    }

    if (typeof global.only_apps_installed === "undefined") {
        global.only_apps_installed = false;
    }

    if (typeof global.only_devs_assigned === "undefined") {
        global.only_devs_assigned = false;
    }

    if (typeof global.pks_availables === "undefined") {
        global.pks_availables = getPkgNames();
    }
}

function ready() {
    const fs = require("fs");
    var gui = require('nw.gui');
    global.idx = 0;
    win = gui.Window.get()
    getGlobalData();
    $("#sync").click(sync);
    if (global.sync) {
        if (fs.existsSync(consoleLog)) {
            fs.unlinkSync(consoleLog);
            global.terminal = {};
        }
        if (global.settings["show_details_to_sync"]) {
            win.show();
        } else {
            win.show();
            win.minimize();
        }
        showDetails();
        sync_each_24();
    } else {
        setTimeout(sync_each_24, 24*60*60*1000);
        fs.stat(consoleLog, function(err, stat) {
            if (err === null) {
                // consoleLog exists
                var data = fs.readFileSync(consoleLog, "utf8");
                global.terminal = JSON.parse(data);
                global.idx = Object.keys(global.terminal).length;
            }
        });

        win.show();
    }

    if (! global.settings["show_menu_apps"]) {
       $("#menu-apps").addClass("hide");
    }

    if (! global.settings["show_menu_devices"]) {
       $("#menu-devices").addClass("hide");
    }

    if (! global.settings["show_menu_details"]) {
       $("#menu-details").addClass("hide");
    }

    if (! global.settings["show_menu_information"]) {
       $("#menu-information").addClass("hide");
    }

    if (! global.settings["show_menu_settings"]) {
       $("#menu-settings").addClass("hide");
    }

    if (! global.settings["show_menu_help"]) {
       $("#menu-help").addClass("hide");
    }

    $("#menu-apps").prop("title",_("Applications"));
    $("#menu-apps").click(showApps);

    $("#menu-devices").prop("title",_("Devices"));
    $("#menu-devices").click(showDevices);

    $("#menu-details").prop("title",_("Details"));
    $("#menu-details").click(showDetails);

    $("#menu-information").prop("title",_("Information"));
    $("#menu-information").click(showLabel);

    $("#menu-settings").prop("title",_("Settings"));
    $("#menu-settings").click(showSettings);

    $("#menu-help").prop("title",_("Help"));
}
