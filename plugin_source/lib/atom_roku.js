
var Archiver = require('archiver');
var CompositeDisposable = require('atom').CompositeDisposable;
var Directory = require('atom').Directory;
var fs = require('fs');
var request = require('request');

module.exports = rokuDeploy = {
    rokuIpAddress       :   null,
    rokuDevPassword     :   null,
    rokuDevUsername     :   null,
    disposable          :   null,
    excludedPaths       :   null,
    outputDirectory     :   null,
    separator           :   null,
    projectName         :   "out",

    config: {
        rokuIpAddress: {
            title       : 'IP Address of Roku box',
            description : 'IP Address of Roku box in local network.',
            type        : 'string',
            default     : '192.168.0.14'
        },
        rokuDevUsername: {
            title       : 'Developer username',
            description : 'Developer username (set when Developer mode turn on)',
            type        : 'string',
            default     : 'rokudev'
        },
        rokuDevPassword: {
            title       : 'Developer password',
            description : 'Developer password (set when Developer mode turn on)',
            type        : 'string',
            default     : 'test'
        },
        excludedPaths: {
            title       : 'Folders to exclude',
            description : 'Folders to exclude',
            type        : 'string',
            default     : 'out'
        },
        outputDirectory: {
            title       : 'Location of zip',
            description : 'Directory name where deploy zip located',
            type        : 'string',
            default     : 'out'
        }
    },

    activate: function(state) {
        this.rokuIpAddress      = atom.config.get('atom_roku.rokuIpAddress');
        this.rokuDevUsername    = atom.config.get('atom_roku.rokuDevUsername');
        this.rokuDevPassword    = atom.config.get('atom_roku.rokuDevPassword');
        this.excludedPaths      = atom.config.get('atom_roku.excludedPaths');
        this.outputDirectory    = atom.config.get('atom_roku.outputDirectory');
        this.disposable         = new CompositeDisposable;
        this.separator          = process.platform != 'win32' ? '/' : '\\';

        this.disposable.add(atom.commands.add('atom-workspace', {
            'atom_roku:rokuDeploy': (function(_this) {
                return function() {
                    _this.rokuDeployRun();
                };
            })(this)
        }));
    },

    deactivate: function() {
        this.disposable.dispose();
    },

    rokuDeployRun: function() {
        this.rokuIpAddress      = atom.config.get('atom_roku.rokuIpAddress');
        this.rokuDevUsername    = atom.config.get('atom_roku.rokuDevUsername');
        this.rokuDevPassword    = atom.config.get('atom_roku.rokuDevPassword');
        this.excludedPaths      = atom.config.get('atom_roku.excludedPaths');
        this.outputDirectory    = atom.config.get('atom_roku.outputDirectory');
        this.projectPath        = this.getProjectPath();
        this.isStopsInProject(this.projectPath);
        this.zipPackage();
    },


    zipPackage: function() {
        atom.notifications.addInfo('Deployment started.');
        // Make Home press request to know that box exist
        request.post('http://' + this.rokuIpAddress + ':8060/keypress/Home')
            .on('response', function(response) {
                if (response !== void 0) {
                    if (response.statusCode !== null && response.statusCode === 200) {
                        module.exports.makeZip();
                    } else {
                        atom.notifications.addError('Sending Home error!');
                        if (response !== void 0) {
                            atom.notifications.addError(response.body);
                        }
                    }
                } else {
                    atom.notifications.addError("Some error happened. Request didnt returned.\nIs proper IP addess setted?");
                }
            });
    },

    makeZip: function() {
        if (!this.projectPath){
            atom.notifications.addError("Some error with project path!\nTry to open other file and run deploy.\nMake sure you are focused at opened file in text editor.");
            return;
        }

        var projectDir = new Directory(this.projectPath);
        this.projectName = projectDir.getBaseName()
        if (projectDir !== void 0) {
            var projectRealPath = projectDir.getRealPathSync();
            if(projectRealPath == null){
                atom.notifications.addError("Some error with path!\nCheck if manifest in your project.");
                return;
            }
            var pathToZip = projectRealPath + this.separator + this.outputDirectory + this.separator;
            atom.notifications.addInfo("Result zip path:\n" + pathToZip);
            var stat;
            try {
                stat = fs.lstatSync(pathToZip);
            } catch (_error) {
                // Out dir is not found
                fs.mkdirSync(pathToZip);
                stat = fs.lstatSync(pathToZip);
                if (!stat.isDirectory()) {
                    atom.notifications.addFatalError("Can't create Out directory!\nCheck permissions!");
                    return;
                }
            }
            var zipFile = fs.createWriteStream(pathToZip + this.projectName + ".zip");
            this.zip = Archiver('zip');
            zipFile.on('close', this.postZipToBox);
            this.zip.on('error', function(err) {
                throw err;
            });
            this.zip.pipe(zipFile);

            // Check excluded paths
            var splitExcludedPaths = this.excludedPaths.toLocaleLowerCase().split(',');
            var ref = projectDir.getEntriesSync();
            var j = 0, len = ref.length;
            for (; j < len; j++) {
                var directory = ref[j];
                if (directory.isDirectory() && !directory.getBaseName().startsWith('.')){
                    var isDirNotInExcluded = splitExcludedPaths.indexOf(directory.getBaseName().toLocaleLowerCase()) === -1;
                    if ( isDirNotInExcluded ) {
                        this.zip.directory(directory.getRealPathSync(), directory.getBaseName());
                    }
                }
            }
            var params = {
                expand  :   true,
                cwd     :   projectDir.getRealPathSync(),
                src     :   ['manifest'],
                dest    :   ''
            };
            this.zip.bulk(params);
        }else{
            atom.notifications.addError("Some error with path!");
            return;
        }
        this.zip.finalize();
    },

    postZipToBox: function() {
        var installPath, pathToZip, projectDir, directProjectPath, params;

        atom.notifications.addInfo("Zipping completed. Starting deploy to \n" + module.exports.rokuIpAddress);

        // Configure vars for deploy

        installPath = 'http://' + module.exports.rokuIpAddress + '/plugin_install';

        projectDir = new Directory(module.exports.projectPath);
        directProjectPath = projectDir.getRealPathSync();
        pathToZip = directProjectPath + module.exports.separator + module.exports.outputDirectory + module.exports.separator;

        params = {
            url         :   installPath,
            formData    :   {
                mysubmit    : 'Replace', // Not install to know that same code is installed
                archive     : fs.createReadStream(pathToZip + module.exports.projectName + '.zip')
            }
        };

        // Make post request
        request.post(params, module.exports.deployCallback).auth(module.exports.rokuDevUsername, module.exports.rokuDevPassword, false);
    },

    deployCallback: function(error, response, body) {
        if (response !== void 0 && response != null && response.statusCode !== null && response.statusCode === 200) {
            if (response.body.indexOf("Identical to previous version -- not replacing.") !== -1) {
                atom.notifications.addWarning(response.body);
            } else {
                atom.notifications.addSuccess('Deployed to ' + module.exports.rokuIpAddress);
            }
        } else {
            atom.notifications.addError("Failed to deploy to " + module.exports.rokuIpAddress + ". \nCheck IP address, username and dev password in settings.");
            if(error !== null){
                atom.notifications.addError("Error: " + error);
            }
        }
    },


    getProjectPath: function(maxDepth = 10) {
        var editor, file, i, j, path, pathList, editorBuffer, fileParent;
        editor = atom.workspace.getActivePaneItem();
        path = editor != null && typeof(editor.getPath) === "function" ? ""+editor.getPath() : "";
        var lastSeparatorPosition = path.lastIndexOf(this.separator);
        path = path.substring(0, lastSeparatorPosition + 1);
        var isPathListHasManifest = false;
        if(path != null && path != ""){
            do{
                pathList = fs.readdirSync(path);
                isPathListHasManifest = pathList.indexOf("manifest") != -1;
                if ( !isPathListHasManifest ) {
                    path += this.separator + '..';
                }
                maxDepth--;
            }while(!isPathListHasManifest && maxDepth > 0);
        }
        if(maxDepth == 0 || path == "")path=null;
        return path;
    },


    isStopsInProject: function(projectPath = "") {
        // TODO add checking for arrays
        var recursive = require('recursive-readdir');
        if(projectPath == null){
            return;
        }
        recursive(projectPath, function(err, files){
            if(files == null || files.constructor !== Array){
                return;
            }
            files.forEach(function(file){
                if(file != null && file.toLowerCase().indexOf('.brs') != -1){
                    var fileContent = fs.readFileSync(file, "utf8");
                    var lines = fileContent.split('\n');
                    lines.forEach(function(fileContent){
                        var res = fileContent.match(/^(\s*)(?=[^'])(?=[^']*then)*(?=[^']*else)*(\s*)(stop)(\s*)$/g);
                        if(res!=null){
                            atom.notifications.addWarning("! Stops are in project !")
                            return;
                        }
                    });
                }
            });
        });
    }
};

