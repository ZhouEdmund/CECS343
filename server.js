var express = require('express');
var app = express();
var path = require('path');
const fs = require('fs');
const readline = require('readline');
var manifest = '';
var manifests = '';
var grandmaManifest = '';

// viewed at http://localhost:3000

/**
 * Gets the base html page to load
 */
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

/**
 * Commits files to a Repo based on html form
 */
app.get('/get_create', function (req, res) {
    output = '';
    manifest = '';
    commit(req.query.origin, req.query.target);
    res.end('Files successfully created\n' + manifest);
});

/**
 * Checks-in the changed files in the project into the repo
 */
app.get('/get_check_in', function (req, res) {
    output = '';
    manifest = '';
    commit(req.query.fileLoc, req.query.repoCheckInLoc);
    res.end('Files successfully checked in\n');
});

/**
 * Checks out the project given the manifest title and a new empty folder
 */
app.get('/get_check_out', function (req, res) {
    checkOut(req.query.manifestName, req.query.checkoutTarget, req.query.checkoutRepoLoc);
    res.end('Files successfully checked out\n');
});

/**
 * Creates a label for a manifest file
 */
app.get('/get_label', function (req, res) {
    label(req.query.label, req.query.labelRepoLoc, req.query.labelManifestName);
    res.end('Label succesfuly created\n');
});

/**
 * Gets a list of all the manifest files
 */
app.get('/get_list', function (req, res) {
    manifests = '';
    list(req.query.repoLoc);
    res.end('List of manifests:\n' + manifests);
});

/**
 * Performs merge out command
 */
app.get('/get_merge_out', function (req, res) {
    mergeOut(req.query.repoLoc, req.query.repoSnapLoc, req.query.targetLoc);
    res.end('Merge Out successful.\n' + manifests);
});

/**
 * Merge in the changed files in the project into the repo
 */
app.get('/get_merge_in', function (req, res) {
    output = '';
    manifest = '';
    commit(req.query.mergeFileLoc, req.query.mergeRepoCheckInLoc);
    res.end('Files successfully merged in\n');
});

app.listen(3000);

function mergeOut(repoLoc, repoSnapLoc, targetLoc)
{
    //Commits the target snapshot to the repo
    commit(targetLoc, repoLoc);

    //First commits unique R snapshot files, then adds common R files to the target snapshot
    //Finally, the manifest is generated
    commitR(repoSnapLoc, repoLoc, targetLoc, function ()
    {
        //If the manifest includes Grandma Manifest, it means it was already written to file
        if (!manifest.includes("Grandma Manifest")) {
            //Directory is looked through to add files to the manifest
            fs.readdirSync(targetLoc).forEach(file => {

                manifest += file + '\n';
            });
            manifest += "Grandma Manifest: " + grandmaManifest + '\n';

            //Manifest is written to file
            writeToFile(manifestTitle, manifest, repoLoc);
        }
    });


}

/**
 * Commits the snapshot files and handles any collisions
 * @param {type} dir directory of the R snapshot
 * @param {type} target Repo location
 * @param {type} targetRepo Target snapshot repo
 */
function commitR(dir, target, targetRepo, callback) {
    manifest = "";

// log date and time of creation to manifest file
    var today = new Date();
    var myDateTime = today.getFullYear() + '.'
            + ('0' + (today.getMonth() + 1)).slice(-2) + '.'
            + ('0' + today.getDate()).slice(-2) + '_'
            + ('0' + today.getHours()).slice(-2) + '.'
            + ('0' + today.getMinutes()).slice(-2) + '.'
            + ('0' + today.getSeconds()).slice(-2);
    manifest += myDateTime + '\n';
    manifestTitle = 'manifest_' + myDateTime + '_merge_out.rc';

    // copy each item in the origin to the target
    walkDir(dir, function (filePath) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        var pval = checksum(filePath.substring(0, filePath.lastIndexOf("\\")));
        var lval = fileContents.length;
        var cval = checksum(fileContents);
        var extensionval = path.extname(filePath);
        var artifactID = 'P' + pval + '-L' + lval + '-C' + cval + extensionval;
        var temp = "";
        var temp2 = "";
        var temp3 = "";
        var temp4 = "";
        var currManifest = "none";

        //Manifest where Target files were added are found along with the grandma manifest
        fs.readdirSync(target).forEach(file => {
            if (file.substring(0, 1) === "P" && currManifest === "none")
            {
                currManifest = temp2;
                if (temp4 === "")
                {
                    grandmaManifest = temp2;
                }
                else
                {
                    grandmaManifest = temp4;
                }
                
            }
            temp4 = temp3;
            temp3 = temp2;
            temp2 = temp;
            temp = file;
        });

        //Manifest with t files is read to compare and find collison files
        const readInterface = readline.createInterface({
            input: fs.createReadStream(target + '\\' + currManifest)
        });
        var readTemp = "none";

        readInterface.on('line', function (line)
        {
            var name = filePath.substring(filePath.lastIndexOf("\\") + 1, filePath.length);
            var ext = filePath.substring(filePath.lastIndexOf("."), filePath.length);
            //When the R snapshot and T snapshot files are the same,
            //they need to be renamed and added to the target location
            if (line.substring((line.length - name.length), line.length) === name)
            {
                readTemp = line;

            } else
            {
                if (readTemp !== "none")
                {
                    if (artifactID !== line)
                    {
                        var rName = name.substring(0, name.lastIndexOf(".")) + "_MR" + ext;

                        readTemp = "none";

                        fs.writeFileSync(rName, fileContents);

                        moveFile(rName, targetRepo);

                        //write to target folder a copy of the file with a new name
                        var contents = fs.readFileSync(targetRepo + '\\' + name, "utf8", function ()
                        { });

                        fs.unlink(targetRepo + '\\' + name, function (error) {
                            if (error) {
                                throw error;
                            }
                        });

                        var tName = name.substring(0, name.lastIndexOf(".")) + "_MT" + ext;

                        fs.writeFileSync(tName, contents);

                        moveFile(tName, targetRepo);



                    }
                }
            }
        })
                .on('close', function (line) {
                });

        //Grandma Manifest is read to create the grandma files
        const readInterface2 = readline.createInterface({
            input: fs.createReadStream(target + '\\' + grandmaManifest)
        });
        var readTemp = "none";

        readInterface2.on('line', function (line)
        {
            var name = filePath.substring(filePath.lastIndexOf("\\") + 1, filePath.length);
            var ext = filePath.substring(filePath.lastIndexOf("."), filePath.length);
            if (line.substring((line.length - name.length), line.length) === name)
            {
                readTemp = line;
            } else
            {
                if (readTemp !== "none")
                {
                    if (artifactID !== line)
                    {

                        var gName = name.substring(0, name.lastIndexOf(".")) + "_MG" + ext;

                        readTemp = "none";

                        //write to target folder a copy of the file with a new name
                        var gContents = fs.readFileSync(target + '\\' + line, "utf8", function ()
                        { });

                        fs.writeFileSync(gName, gContents);

                        moveFile(gName, targetRepo);

                    }
                }
            }
        })
                .on('close', function (line) {
                    callback();
                });
    });
}
;


/**
 * Checksout the project into a given empty folder
 * @param {type} manifestName manifest file of version of project to check out
 * @param {type} checkoutTarget empty folder location for manifest to go
 * @param {type} repoLoc location of repo to take out of
 */
function checkOut(manifestName, checkoutTarget, repoLoc) {

    fs.readdirSync(repoLoc).forEach(file => {
        //If the file is a labels file it will have labels in this position
        if (file.substring(file.length - 9, file.length - 3) === 'labels')
        {
            //The contents of the labels file is extractd
            var contents = fs.readFileSync(repoLoc + '\\' + file, "utf8", function ()
            { });
            //If the contents has the given label in it then that is the correct manifest
            if (contents.includes(manifestName + '\n'))
            {
                manifestName = file.substring(0, file.length - 10) + '.rc';
            }

        }

    });
    console.log(manifestName);
    //Read stream is made on the manifest file so its contents can be read
    const readInterface = readline.createInterface({
        input: fs.createReadStream(repoLoc + '\\' + manifestName)
    });
    //variables are initialized
    var manifestContents = 'Checkout: \n';
    var originalName = "";
    var contents = "";
    //Date is established as now for checkout manifest file
    var today = new Date();
    var myDateTime = today.getFullYear() + '.'
            + ('0' + (today.getMonth() + 1)).slice(-2) + '.'
            + ('0' + today.getDate()).slice(-2) + '_'
            + ('0' + today.getHours()).slice(-2) + '.'
            + ('0' + today.getMinutes()).slice(-2) + '.'
            + ('0' + today.getSeconds()).slice(-2);
    var checkoutManTitle = 'Checkout_manifest_' + myDateTime + '.rc';
    //File is read from line by line
    readInterface.on('line', function (line)
    {
        //Lines in the manifest with '/' are file directories so the title of
        //the original files are derived from here
        if (line.includes('\\'))
        {
            originalName = checkoutTarget + line.substring(line.lastIndexOf('\\'), line.length);
            manifestContents = manifestContents + originalName + '\n';
            //Lines with '/' are date lines and can be skipped
            //The remaining lines are the aritfact file names
        } else if (line.includes('-'))
        {
            contents = fs.readFileSync(repoLoc + '\\' + line, 'utf8');
            manifestContents = manifestContents + line + '\n';
        }
        //When both the name and contents are filled out, a file is created
        if (originalName !== "" && contents !== "")
        {
            fs.writeFileSync(originalName, contents);
            originalName = "";
            contents = "";
        }

    })
            //When the file is at the end and the stream is closed, the manifest
            //file for the checkout is created
            .on('close', function (line) {
                writeToFile(checkoutManTitle, manifestContents, repoLoc);
            });
}

/**
 * Creates a label for the given manifest file
 */
function label(label, repoLoc, manifestName) {
    var labelFile = repoLoc;
    //If the manifestName stars with manifest it means it is a manifest file and
    //it is not a label
    if (manifestName.startsWith('manifest'))
    {
        //File name for the manifest labels is stored in labelFile
        labelFile = labelFile + '\\' + manifestName;
        labelFile = labelFile.substring(0, labelFile.length - 3) + '_labels.rc';
    }
    //If the manifest name doesn't start with manifest it means it was a label given
    else
    {
        //The directory is read
        fs.readdirSync(repoLoc).forEach(file => {
            //If the file is a labels file it will have labels in this position
            if (file.substring(file.length - 9, file.length - 3) === 'labels')
            {
                //The contents of the labels file is extractd
                var contents = fs.readFileSync(repoLoc + '\\' + file, "utf8", function ()
                { });
                //If the contents has the given label in it then that is the correct manifest
                if (contents.includes(manifestName + '\n'))
                {
                    labelFile = labelFile + '\\' + file;
                }
            }
        });
    }
    //Writer writes the new label into the labels file
    var writer = fs.createWriteStream(labelFile, {
        flags: 'a'
    });
    writer.write(label + '\n');
    writer.end();
}

/**
 * Function for creating a string of all the manifest file titles
 * @param {type} repoLoc location of the repo
 */
function list(repoLoc) {
    //File titles are read and those that start with 'manifest' are manifest
    //files and therefore need to be added to the string to display the list
    fs.readdirSync(repoLoc).forEach(file => {
        if (file.substring(0, 8) === "manifest") {
            if (file.substring(file.length - 9, file.length - 3) === "labels")
            {
                manifests += 'Labels: \n';
                manifests += fs.readFileSync(repoLoc + '\\' + file, "utf8", function () {
                });
            } else {
                manifests = manifests + file + '\n';
            }
        }
    }
    );
}


/**
 * A function to calculate the weighted checksum
 * of a string
 */
function checksum(str = 'def')
{
    var sum = 0;
    var weight = 1;
    for (var i = 0; i < str.length; i++)
    {
        switch (i % 4)
        {
            case 0:
                weight = 1;
                break;
            case 1:
                weight = 7;
                break;
            case 2:
                weight = 3;
                break;
            case 3:
                weight = 11;
                break;
        }
        sum += str.charCodeAt(i) * weight;
    }
    return sum % 10000;
}

/**
 * A function to walk through all the files of
 * a directory and use a callback function each
 */
function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ?
                walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

/**
 * Commits files in a directory to a target
 * repository
 */
function commit(dir, target) {

    // log date and time of creation to manifest file
    var today = new Date();
    var myDateTime = today.getFullYear() + '.'
            + ('0' + (today.getMonth() + 1)).slice(-2) + '.'
            + ('0' + today.getDate()).slice(-2) + '_'
            + ('0' + today.getHours()).slice(-2) + '.'
            + ('0' + today.getMinutes()).slice(-2) + '.'
            + ('0' + today.getSeconds()).slice(-2);
    manifest += myDateTime + '\n';
    // copy each item in the origin to the target
    walkDir(dir, function (filePath) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        var pval = checksum(filePath.substring(0, filePath.lastIndexOf("\\")));
        var lval = fileContents.length;
        var cval = checksum(fileContents);
        var extensionval = path.extname(filePath);
        var artifactID = 'P' + pval + '-L' + lval + '-C' + cval + extensionval;
        manifest += filePath + '\n' + artifactID + '\n';
        // create file first
        fs.writeFileSync(artifactID, fileContents);
        // move the file to specify directory
        moveFile(artifactID, target);
    });
    // save the manifest file

    manifestTitle = 'manifest_' + myDateTime;
    writeToFile(manifestTitle + '.rc', manifest, target);
    writeToFile(manifestTitle + '_labels.rc', '', target);
}

function writeToFile(file, fileContent) {
    fs.writeFile(file, fileContent, (err) => {
        // throws an error, you could also catch it here
        if (err)
            throw err;
    });
}

function writeToFile(file, fileContent, dest) {
    fs.writeFile(file, fileContent, (err) => {
        // throws an error, you could also catch it here
        if (err)
            throw err;
        moveFile(file, dest);
    });
}
;
/**
 * a function to move an existing file in the 
 * current directory to a specified directory
 */
function moveFile(file, targetD) {
    var f = path.basename(file);
    var dest = path.resolve(targetD, f);
    fs.rename(file, dest, (err) => {
        if (err)
            throw err;
    });
}
;

