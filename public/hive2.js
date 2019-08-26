 var treeMap = new Map();


 function generateVocList(string) {
    vocobj = JSON.parse(string);
    vlen = vocobj.vocs.length;
    if (vlen > 0) {
       var main = document.querySelector("#main");
       // HTML <template> for each vocabulary row
       var template = document.querySelector("#vocrow");
       var tbody = document.querySelector("tbody");

       for (i=0; i<vlen; i++)  {
          voc = vocobj.vocs[i].name;
          vocs.push(voc);
          vocLongName = vocobj.vocs[i].longname;
          voclc = voc.toLowerCase();

          var clone = document.importNode(template.content, true);
          td = clone.querySelectorAll("td");
          td[0].textContent = vocobj.vocs[i].longname;
          td[0].setAttribute('class', 'voclink');
          var clickCall = "browseVoc(" +    "'" + voclc + "', '" + vocLongName + "')";
          td[0].setAttribute('onclick', clickCall);
          td[1].textContent = vocobj.vocs[i].name;
          td[2].textContent = vocobj.vocs[i].numConcepts;
          td[3].textContent = vocobj.vocs[i].lastUpdated;
          //td[3].textContent = vocobj.vocs[i].uri;
          tbody.appendChild(clone);
       }
       vocs.sort();
    }
    else {
       var noVoc = document.createElement("p");
       noVoc.appendChild(document.createTextNode('No vocabularies are available'));
       main.appendChild(noVoc);
    }
 }

 function showVocList() {
    var voclist = document.querySelector("#main").style.display = "block";
    document.querySelector("#details").style.display = "none";
    document.querySelector('#vocNav').style.backgroundColor = "paleturquoise";
    document.querySelector('#searchNav').style.backgroundColor = "#3fb0ac";
    document.querySelector('#indexNav').style.backgroundColor = "#3fb0ac";
 }

function browseVoc(voc, longname)  {
   formatView = "list";  // default view, reset when select another vocabulary
   //currentMode = "browse";
   currentVoc = voc;
   document.querySelector("#voctable").style.display="none";
   document.querySelector("#main").style.display = "none";
   document.querySelector("#browseBySearch").style.display = "none";
   document.querySelector("#vocheader").textContent = longname;
   document.querySelector("#vocheader").setAttribute('class', 'vocname');

   if (voc == "lcsh" || voc == "mesh") {
      var bbs = document.querySelector("#browseBySearch");
      bbs.style.display = "block";
      var tmr = document.querySelector("#toomanyresults");
      var bbs_button = document.querySelector("#browsesearch-button");
      bbs_button.addEventListener('click',function(){
         var tv = document.querySelector("#treeview");
         document.querySelector("#details").style.display = "none";
         while (tv.hasChildNodes())  {
            tv.removeChild(tv.firstChild);  }
         var spannoconcept = document.querySelector("#noconcept");
         spannoconcept.textContent = '';
         var inputOK = true;
         var bbsterm = document.querySelector("#browsesearchterm");
         var searchterm = bbsterm.value.trim();
         if (searchterm.length == 0) {
            spannoconcept.textContent = "A search term must be provided";
            inputOK = false;         }
         else {
            while (searchterm.includes('  '))
               searchterm = searchterm.replace('  ',' ');
            searchterm = searchterm.replace(/ /gi,'+');
         }
         if (inputOK) {
            var url = "/getTopConcepts?voc=" + voc + "&search=" + searchterm;
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
               if (xhr.readyState === XMLHttpRequest.DONE) {
                  if (xhr.status === 200) {
                     formatView = "list";
                     selectedConceptsByVoc = new Map();
                     generateConceptList(xhr.response, null);
                  }
               }
            }
            xhr.open('GET', url);
            xhr.send();
         }

      });
   }
   else {
      var url = "/getTopConcepts?voc=" + voc + "&search=null";
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
         if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
               formatView = "list";
               selectedConceptsByVoc = new Map();
               generateConceptList(xhr.response, null);
            }
         }
      }
      xhr.open('GET', url);
      xhr.send();
   }
}

function getNarrowerConceptsList(voc, uri, parent, icon) {
   var url = "/getNarrowerConcepts?voc=" + voc + "&uri=" + encodeURIComponent(uri);
   var xhr = new XMLHttpRequest();

   xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
         formatView = "list";
         var ulist = generateConceptList(xhr.response, parent);
         ul_li = treeMap.get(icon);
         ul_li[1] = ulist;
         treeMap.set(icon, ul_li);
      }
    }
   }
   xhr.open('GET', url);
   xhr.send();
}

 function generateConceptList(string, parent) {
    var searchmsg = document.querySelector('#noconcept');
    if (string == '') {  // Browse by search (lcsh, mesh) scenario where no results found
       searchmsg.textContent = "No results found for your search";
       return
    }
    else
       searchmsg.textContent = "";

    var obj = JSON.parse(string);
    for (i=0; i<obj.length; i++) {  // loop thru each voc -- should only be one for this function
       clen = obj[i].concepts.length;
       tv = document.querySelector("#treeview");

       var termlist = document.createElement('ul');
       termlist.setAttribute('class', 'nobullets');

       if (parent != null) {
          parent.appendChild(termlist);
       }
       else {
          tv.appendChild(termlist);
       }

       for (j=0; j<clen; j++)  {
          var termli = document.createElement('li');
          termlist.appendChild(termli);

          var termspan = document.createElement('span');
          //termli.appendChild(termspan);
          termspan.setAttribute('class', 'linkedterm concept');   // 'font4 linkedterm concept');
          termspan.setAttribute('selected', 'false');
          termspan.setAttribute('uri', obj[i].concepts[j].uri);
          termspan.setAttribute('voc', obj[i].voc);

          termspan.appendChild(document.createTextNode(obj[i].concepts[j].prefLabel));
          termspan.addEventListener('click',function(){
             getConceptInfo(this.getAttribute('uri'), this.getAttribute('voc'));
             // TEMP, need to fix; gen's a null error   grayOutOtherCurrentSelections(termlist);
             if (this.getAttribute('selected') == 'true') { // then de-select
                this.style.backgroundColor = "transparent";
                this.setAttribute('selected', 'false');
             }
             else {
                this.style.backgroundColor = "paleturquoise";
                this.setAttribute('selected', 'true');
             }
          }
          );
          var icon = document.createElement('i');
          icon.setAttribute('uri', obj[i].concepts[j].uri);
          icon.setAttribute('voc', obj[i].voc);
          var li_ul = [termli, null];
          treeMap.set(icon, li_ul);


          if (obj[i].concepts[j].score > 0) {
              icon.setAttribute('class', 'iconplus far fa-plus-square');
              icon.addEventListener('click', function() {
                  var li_ul = treeMap.get(this);
                  if (this.className == 'iconplus') {   // if collapsed, then expand (show)
                     if (li_ul[1] != null) {   // <ul> defined for this icon
                        li_ul[1].style.display = "block";
                     }
                     else {  // <ul> to be created for this icon
                        getNarrowerConceptsList(this.getAttribute('voc'), this.getAttribute('uri'), li_ul[0], this)
                        //_ul[1] = ulist;
                        treeMap.set(this, li_ul);
                     }
                     this.className = 'iconminus far fa-minus-square';
                  }
                  else {   // must be expanded, so collapse (hide)
                     this.className = 'iconplus far fa-plus-square';
                     li_ul = treeMap.get(this);
                     li_ul[1].style.display = "none";
                  }
              })
          }
          else {
              icon.setAttribute('class', 'icondash fas fa-minus');
          }
          termli.appendChild(icon);
          termli.appendChild(termspan);
       }
       return termlist;
    }
  }

 function searchForConcept()  {
    document.querySelector('#vocNav').style.backgroundColor = "#3fb0ac";
    document.querySelector('#searchNav').style.backgroundColor = "paleturquoise";
    document.querySelector('#indexNav').style.backgroundColor = "#3fb0ac";

    var usermessage = '';
    var vocheader = document.querySelector("#vocheader");
    vocheader.style.display = "block";

	createVocCheckBoxes();

    var searchterm = document.querySelector("#searchterm");
    searchterm.addEventListener('change', validateAndSearch);
    var searchbutton = document.querySelector("#search-button");
    searchbutton.addEventListener('click', validateAndSearch);

    function validateAndSearch () {
       var spannovoc = document.querySelector("#novocsel")
       var spannoconcept = document.querySelector("#noconcept")
       spannovoc.innerHTML = '';
       spannoconcept.innerHTML = '';
       var inputOK = true;
       parms = getVocabularySelections();
       if (parms.length == 0)  {
          spannovoc.textContent = "Select at least one vocabulary";
          inputOK = false;     }
       term = searchterm.value.trim();

       if (term.length == 0) {
          spannoconcept.textContent = "A search term must be provided";
          inputOK = false;         }
       else {
          while (term.includes('  '))
             term = term.replace('  ',' ');
          term = term.replace(/ /gi,'+');
       }
       if (inputOK)
          searchVocabularies(term, parms);
    }
 }

 function createVocCheckBoxes() {
    var vocsels = document.querySelector("#vocsels");
    var voclist = document.querySelector("#voclist");
    var template = document.querySelector("#checkbox");
    for (i=0; i<vocs.length; i++) {
       var clone = document.importNode(template.content, true);
       input = clone.querySelector("input");
       input.textContent = vocs[i];
       input.setAttribute("value", vocs[i]);
       input.setAttribute("id", vocs[i]);

       label = clone.querySelector("label");
       label.textContent = (vocs[i]);
       label.setAttribute("for", vocs[i]);
       voclist.appendChild(clone);
    }
  }

 function searchVocabularies(searchterm, vocs) {
    document.querySelector("#details").style.display = "none";
    var searchmsg = document.querySelector('#noconcept');

    var spinner = document.createElement('i');
    spinner.setAttribute('class', 'fa fa-spinner fa-spin fa-1x fa-fw');
    searchmsg.appendChild(spinner);
    searchmsg.appendChild(document.createTextNode(" Searching..."));

    var url = "/searchForConcept?term=" + encodeURIComponent(searchterm) + "&vocs=" + vocs;
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'text';
    xhr.onreadystatechange = function() {
       if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status === 200) {
             formatView = "list";
             //currentMode = "search";
             selectedConceptsByVoc = new Map();
             generateSearchedTermList(xhr.response);
          }
       }
    }
    xhr.open('GET', url);
    xhr.send(null);
 }

 function getVocabularySelections() {
    vocSelections = document.querySelector("#vocsels");
    var selections = vocSelections.getElementsByTagName('input');
    var val = '';
    for (i=0; i<selections.length; i++) {
       if (selections[i].checked)
          val = val + selections[i].value + ',';
    }
    if ((val.length > 0) && (val.charAt(val.length-1) == ','))
       val = val.substr(0, val.length-1);
    return val;
 }

 function getIndexingParmsSelections()  {
    var minchar = document.querySelector('#minchar').value;
    var maxwords = document.querySelector('#maxwords').value;
    var minfreq = document.querySelector('#minfreq').value;
    var maxresults = document.querySelector('#maxresults').value;
    return minchar + ',' + maxwords + ',' + minfreq + ',' + maxresults;
 }

 function generateSearchedTermList(string) {
    var cv = document.querySelector('#conceptview');
    var tl = document.querySelector('#termlist');
    while (tl.hasChildNodes())  {
       tl.removeChild(tl.firstChild);  }
    var nc = document.querySelector('#noconcept');
    if (nc != null) {
       while (nc.hasChildNodes())  {
          nc.removeChild(nc.firstChild);  }
    }

    var obj = JSON.parse(string);
    for (i=0; i<obj.length; i++) {  // loop thru each voc
       clen = obj[i].concepts.length;
       var divlist = document.createElement('div');
       divlist.setAttribute('id', 'cloud'+i);
       var vochdr = document.createElement('h4');
       vochdr.setAttribute('id', 'vocname'+i);
       vochdr.setAttribute('class', 'vocname');
       vochdr.appendChild(document.createTextNode(obj[i].voc));
       divlist.appendChild(vochdr);
       tl.appendChild(divlist);

       var termlist = document.createElement('ul');
       termlist.setAttribute('class', 'nobullets');
       divlist.appendChild(termlist);

       for (j=0; j<clen; j++)  {
          var termli = document.createElement('li');
          termlist.appendChild(termli);
          var termspan = document.createElement('span');
          termli.appendChild(termspan);
          termspan.setAttribute('class', 'linkedterm concept');   // 'font4 linkedterm concept');
          termspan.setAttribute('selected', 'false');
          termspan.setAttribute('uri', obj[i].concepts[j].uri);
          termspan.setAttribute('voc', obj[i].voc);

          termspan.appendChild(document.createTextNode(obj[i].concepts[j].prefLabel));
          termspan.addEventListener('click',function(){
             getConceptInfo(this.getAttribute('uri'), this.getAttribute('voc'));
             grayOutOtherCurrentSelections(termlist);
             if (this.getAttribute('selected') == 'true') { // then de-select
                this.style.backgroundColor = "transparent";
                this.setAttribute('selected', 'false');
             }
             else {
                this.style.backgroundColor = "paleturquoise";
                this.setAttribute('selected', 'true');
             }
          }
          );
       }
    }
    if (obj.length == 0) {
       var msg = document.createElement('p');
       msg.setAttribute('class', 'usermsg')
       msg.appendChild(document.createTextNode('No results found for your search'));
       tl.appendChild(msg);
    }
  } 
 

 function indexer()  {
    document.querySelector('#vocNav').style.backgroundColor = "#3fb0ac";
    document.querySelector('#searchNav').style.backgroundColor = "#3fb0ac";
    document.querySelector('#indexNav').style.backgroundColor = "paleturquoise";

    formatView = "list";
    //currentMode = "index";
    var usermessage = '';
    var vocheader = document.querySelector("#vocheader");

    createVocCheckBoxes();
    /* Can't have both URL and file specified at the same time */
	indexurl = document.querySelector("#docurl");
	indexfile = document.querySelector("#docfile");
	indexFileSelected = document.querySelector("#selectedfilename");

    indexurl.addEventListener('change', function(){ indexfile.value = ""; indexFileSelected.innerHTML = "No file selected"; });
    indexfile.addEventListener('change', function(){ indexurl.value = "";
                                                     filename = indexfile.value;
                                                     filename = filename.replace(/^.*[\\\/]/, '');
                                                     indexFileSelected.innerHTML = filename; });

    indexbutton = document.querySelector("#index-button");
    indexbutton.addEventListener('click', validateAndIndex);

    function validateAndIndex() {
       spannovoc = document.querySelector("#novocsel");
       spannourl = document.querySelector("#nourl");
       spannovoc.innerHTML = '';
       spannourl.innerHTML = '';
       var parms = getIndexingParmsSelections();
       var vocs = getVocabularySelections();
       if (vocs.length != 0)  {
          var url = indexurl.value.trim();
          if (url.length != 0) {
             indexDocument(url, vocs, parms);
          }
          else {
             var fullpath = indexfile.value.trim();
             // strip off filename here
             var filename = fullpath.replace(/^.*[\\\/]/, '');
             if (filename.length != 0) {
                //alert('filename = ' + filename);
                var formData = new FormData();
                indexFileElement = document.querySelector('#docfile');
                formData.append("docfile", indexFileElement.files[0],indexFileElement.files[0].name);

                var xhr = new XMLHttpRequest();
                xhr.open("POST", "upload", true);
                xhr.onreadystatechange = function() {
                   if (xhr.readyState === XMLHttpRequest.DONE) {
                      if (xhr.status === 200) {
                         indexDocument(filename, vocs, parms);
                      }
                   }
                }
                xhr.send(formData);
             }
             else {
                spannourl.appendChild(document.createTextNode('Enter a URL or choose a file to index'));
             }
          }
       }
       else {
          spannovoc.appendChild(document.createTextNode('Select at least one vocabulary'));
       }
    }
 }


 function indexDocument(indexurl, vocs, parms) {
    var cv = document.querySelector('#conceptview');
    var tv = document.querySelector('#termlist');
    while (tv.hasChildNodes())  {
       tv.removeChild(tv.firstChild);  }
    /* var wc = document.querySelector('#wordcloud');
    while (wc.hasChildNodes())  {
       wc.removeChild(wc.firstChild);  }  */
    var clouds = document.querySelector('#cloudcontainer');
    while (clouds.hasChildNodes())
       clouds.removeChild(clouds.firstChild);
    document.querySelector('#viewselection').style.display = "none";


    document.querySelector("#details").style.display = "none";

    var urlmsg = document.querySelector('#nourl');
    var spinner = document.createElement('i');
    spinner.setAttribute('class', 'fa fa-spinner fa-spin fa-1x fa-fw');
    urlmsg.appendChild(spinner);
    urlmsg.appendChild(document.createTextNode(" Indexing..."));

    var url = "/generateIndex?url=" + indexurl + "&vocs=" + vocs + "&parms=" + parms;
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'text';
    xhr.onreadystatechange = function() {
       if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status === 200) {
             formatView = "list";
             selectedConceptsByVoc = new Map();
             indexResults = xhr.response;
             generateWordCloud(); // indexResults);
          }
       }
    }
    xhr.open('GET', url);   // async=false
    xhr.send(null);
 }


 function generateWordCloud() { // string) {
    //string = indexResults;  //temp
    if (indexResults.includes("urlError")) {
       var badurl = document.querySelector('#nourl');
       badurl.innerHTML = '';
       badurl.appendChild(document.createTextNode('Unable to access the specified URL or file'));
       return;
    }
    if (indexResults == '[]') {
       var badurl = document.querySelector('#nourl');
       badurl.innerHTML = '';
       badurl.appendChild(document.createTextNode('No index terms were found'));
       return;
    }

    var clouds = document.querySelector('#cloudcontainer');
    while (clouds.hasChildNodes())
       clouds.removeChild(clouds.firstChild);


    var obj = JSON.parse(indexResults);   // Default order returned by HIVE API is score order
    // Sort concept prefLabel in alphabetical order
    if (indexOrder == "alpha") {
       for (i=0; i<obj.length; i++) {  // loop thru each voc
          obj[i].concepts.sort(function(a, b) {
             var x = a.prefLabel.toLowerCase();
             var y = b.prefLabel.toLowerCase();
             if (x<y) { return -1;}
             if (x>y) {return 1; }
             return 0;
          } )
       }
    }
    // Sort concept scores in descending numeric order
    if (indexOrder == "score") {
       for (i=0; i<obj.length; i++) {  // loop thru each voc
          obj[i].concepts.sort(function(b, a) {
             return parseFloat(a.score) - parseFloat(b.score)
          } )
       }
    }

    for (i=0; i<obj.length; i++) {  // loop thru each voc
       clen = obj[i].concepts.length;
       var maxscore = 0.0;
       var minscore = 99999.0;
       var totalscore = 0;
       for (j=0; j<clen; j++) {    // loop thru each concept per voc
          var score = (parseFloat(obj[i].concepts[j].score))   // jpb .toFixed(5);
          if (score > maxscore) {
             maxscore = score; }
          if (score < minscore) {
             minscore = score; }
          totalscore = totalscore + score;
       }

       var divcloud = document.createElement('div');
       divcloud.setAttribute('id', 'cloud'+i);
       divcloud.setAttribute('class', 'matched');

       var h3cloud = document.createElement('h3');
       h3cloud.setAttribute('class', 'vocname');
       h3cloud.setAttribute('id', 'vocname'+i);

       h3cloud.appendChild(document.createTextNode(obj[i].voc));
       divcloud.appendChild(h3cloud);

       var indexlist = document.createElement('ul');
       // tempdocument.querySelector('.matched ul')
       // temp test indexlist.setAttribute('class', 'indexes');
       if (indexView == 'cloud')
          indexlist.style.display = "flex";
       else   // indexView = 'list'
          indexlist.style.display = "block";

       divcloud.appendChild(indexlist);

       for (j=0; j<clen; j++)  {
          // normalize score range to 1-10 range for fontsize calculation for word cloud
          relativeScore = (1 + (parseFloat(obj[i].concepts[j].score) - minscore) * (10-1) / (maxscore-minscore)).toFixed(5);
          fontsize = "font" + Math.round(relativeScore).toString();

          var indexitem = document.createElement('li');
          indexlist.appendChild(indexitem);

          var indexspan = document.createElement('span');
          indexspan.setAttribute('class', fontsize + '  linkedterm concept');
          indexspan.setAttribute('selected', 'false');
          indexspan.setAttribute('uri', obj[i].concepts[j].uri);
          indexspan.setAttribute('voc', obj[i].voc);

          indexspan.appendChild(document.createTextNode(obj[i].concepts[j].prefLabel));
          indexitem.appendChild(indexspan);

          indexspan.addEventListener('click',function(){
             getConceptInfo(this.getAttribute('uri'), this.getAttribute('voc'));
             grayOutOtherCurrentSelections(indexlist);
	         if (this.getAttribute('selected') == 'true') {
	            this.style.backgroundColor = "transparent";
	            this.setAttribute('selected', 'false');
	         }
	         else {
	            this.style.backgroundColor = "paleturquoise";
	            this.setAttribute('selected', 'true');
	         }
	      }  );
       }
       clouds.appendChild(divcloud);
    }

    var urlmsg = document.querySelector('#nourl');
    urlmsg.innerHTML = '';
    if (obj.length == 0) {
       var msg = document.createElement('p');
       msg.appendChild(document.createTextNode('No index terms were found.'));
    }
    else {
       document.querySelector('#viewselection').style.display = "flex";
    }
 }

function grayOutOtherCurrentSelections(list) {
   var items = list.childNodes;
   var len = list.childNodes.length;
   for (i=0; i<len; i++) {
      var nodes = items[i].childNodes;
      if (nodes[0].getAttributeNode("selected").value == 'true')
         nodes[0].getAttributeNode("style").value = "background-color: #e6e6e6";
   }
}

function getConceptInfo(id, voc) {
   document.querySelector("#details").style.display = "block";
   document.querySelector("#close-button").addEventListener('click', function(){
      document.querySelector('#details').style.display = "none";    });
   var url = "/getConceptInfo?id=" + encodeURIComponent(id) + "&voc=" + voc;
   var xhr = new XMLHttpRequest();
   xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
         if (xhr.status === 200) {
            currentConceptJson = xhr.response;
            currentVoc = voc;
            if (selectedConceptsByVoc.has(voc)) {
               concepts = selectedConceptsByVoc.get(voc);
               if (concepts.has(id)) {  // already in selections, must be a de-select, so remove
                  concepts.delete(id);
               }
               else {  // add to selections, must be first select (or re-select)
                  concepts.set(id, currentConceptJson);
               }
            }
            else {  // no voc entry for this concept, so must be first select
               concepts = new Map();
               selectedConceptsByVoc.set(voc, concepts);
               concepts.set(id, currentConceptJson);
            }
            concepts = selectedConceptsByVoc.get(voc);
            if (concepts.has(id)) {  // if still a selected concept, display in selected format
               if (formatView == 'list')
                  formatConceptInfoAsList();
               else if (formatView == 'jsonld') {
                  formatConceptInfoAsJSONLD();
               }
               else if (formatView == 'skos')  {
                  formatConceptInfoAsSKOS();
               }
               else if (formatView == 'dublincore')  {
                  formatConceptInfoAsDublinCore();
               }
               else if (formatView == 'xml')  {
                  formatConceptInfoAsXML();
               }
            }
         }
      }
   }
   xhr.open('GET', url);    // async=false is a synchronous request; do not use, altho it solves timing problem with metadata gen
   xhr.send(null);
}

//function createFormatSelection(cv) {
function addEventListenersForFormatSelection() {
   document.querySelector("#list-button").addEventListener('click', formatConceptInfoAsList);
   document.querySelector("#json-button").addEventListener('click', formatConceptInfoAsJSONLD);
   document.querySelector("#skos-button").addEventListener('click', formatConceptInfoAsSKOS);
   document.querySelector("#dc-button").addEventListener('click', formatConceptInfoAsDublinCore);
   document.querySelector("#xml-button").addEventListener('click', formatConceptInfoAsXML);
   document.querySelector("#save-button").addEventListener('click', saveMetadataToClipboard);
   /* document.querySelector("#close-button").addEventListener('click', function(){
      document.querySelector('#details').style.display = "none";    });  */
}

function saveMetadataToClipboard() {
   //currentMode = 'saveMetadata';
   var metadata = '';

   var modal = document.querySelector('#metadataModal');
   var span =  document.querySelector('.close');
   var meta = document.querySelector('#metadataText');
   while (meta.hasChildNodes())  {
      meta.removeChild(meta.firstChild);  }  // remove previous metadata text

   selectedConceptsByVoc.forEach(function(value, key) {
      conceptsForVoc = value;
      currentVoc = key;
      conceptsForVoc.forEach(function(value, key) {
         currentConceptJson = value;
         if (formatView == 'jsonld')
            metadata += generateJSONLDforConcept() + '\n';
         if (formatView == 'skos')
            metadata += generateSKOSforConcept() + '\n';
         if (formatView == 'dublincore')
            metadata += generateDublinCoreForConcept() + '\n';
         if (formatView == 'xml')
            metadata += generateXMLforConcept() + '\n';
      } )
   } )

   meta.appendChild(document.createTextNode(metadata));
   modal.style.display = 'block';
   span.onclick = function() { modal.style.display = 'none'; }
   // When the user clicks anywhere outside of the modal, close it
   window.onclick = function(event) {
      if (event.target == modal) {
         modal.style.display = "none";  }
   }
}

function getVocURI() {
   for (i=0; i < vocobj.vocs.length; i++) {
      if (vocobj.vocs[i].name.toLowerCase() == currentVoc.toLowerCase())
         return vocobj.vocs[i].uri;
   }
   return null;
}

function formatConceptInfoAsJSONLD() {
   formatView = 'jsonld';
   var cv = document.querySelector('#conceptview');
   var clv = document.querySelector('#conceptlistview');
   clv.style.display = 'none';
   var pre = document.querySelector('#pre-format');
   if (pre != null)
      cv.removeChild(pre);

   setFormatSelection(document.querySelector('#json-button'));
   document.querySelector('#save-button').style.display = 'block';

   var jsonld = generateJSONLDforConcept();
   var pre = document.createElement('pre');
   pre.setAttribute('id', 'pre-format');
   pre.appendChild(document.createTextNode(jsonld));
   cv.appendChild(pre);
}

function wrapNotes(notes) {
   frag = 60;
   if (notes.length <= frag) return notes;
   remaining = notes.substr(0);
   notes = '';
   while (remaining.length > 80) {
      temp = remaining.substring(0,80);
      indx = temp.lastIndexOf(' ');
      notes = notes + temp.substring(0,indx) + '\n';
      remaining = '          ' + remaining.substring(indx);
   }
   return notes + remaining;
}

function generateJSONLDforConcept() {
   var conceptobj = JSON.parse(currentConceptJson);

   notes = wrapNotes(conceptobj.notes);

   var jsonld = '';
   jsonld += '{\n';
   jsonld += '  "@context":  {\n';
   jsonld += '    "name": "http://www.w3.org/ns/anno.jsonld",\n';
   jsonld += '    "@id": "' + getVocURI() + '",\n';
   jsonld += '    "@type": "ConceptScheme",\n';
   jsonld += '    "concepts": [\n';
   jsonld += '      {\n';
   jsonld += '        "@id": "' + conceptobj.uri + '",\n';
   jsonld += '        "@type": "Concept",\n';
   jsonld += '        "prefLabel": "' + conceptobj.preflabel + '",\n';
   jsonld += '        "altLabel": "' + conceptobj.altlabel + '",\n';
   //jsonld += '        "notes": "' + conceptobj.notes + '",\n';
   jsonld += '        "notes": "' + notes + '",\n';
   jsonld += '        "broader": [\n';
   for (i=0; i<conceptobj.broaders.length; i++) {
      jsonld += '          "' + conceptobj.broaders[i].uri + '"';
      if (i==conceptobj.broaders.length-1) jsonld += '\n';
      else jsonld += ',\n';
   }
   jsonld += '        ],\n';

   jsonld += '        "narrower": [\n';
   for (i=0; i<conceptobj.narrowers.length; i++) {
      jsonld += '          "' + conceptobj.narrowers[i].uri + '"';
      if (i==conceptobj.narrowers.length-1) jsonld += '\n';
      else jsonld += ',\n';
   }
   jsonld += '        ],\n';

   jsonld += '        "related": [\n';
   for (i=0; i<conceptobj.relateds.length; i++) {
      jsonld += '          "' + conceptobj.relateds[i].uri + '"';
      if (i==conceptobj.relateds.length-1) jsonld += '\n';
      else jsonld += ',\n';
   }
   jsonld += '        ]\n';
   jsonld += '      }\n';
   jsonld += '    ]\n';
   jsonld += '  }\n';
   jsonld += '}\n';
   return jsonld;
}

function formatConceptInfoAsSKOS() {
   formatView = 'skos';
   var cv = document.querySelector('#conceptview');
   var clv = document.querySelector('#conceptlistview');
   clv.style.display = 'none';
   var pre = document.querySelector('#pre-format');
   if (pre != null)
      cv.removeChild(pre);

   setFormatSelection(document.querySelector('#skos-button'));
   document.querySelector('#save-button').style.display = 'block';

   var skos = generateSKOSforConcept();

   var pre = document.createElement('pre');
   pre.setAttribute('id', 'pre-format');
   pre.appendChild(document.createTextNode(skos));
   cv.appendChild(pre);
}

function generateSKOSforConcept() {
   var conceptobj = JSON.parse(currentConceptJson);

   notes = wrapNotes(conceptobj.notes);

   var skos = '';
   skos += '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n';
   skos += '  xmlns:skos="http://www.w3.org/2004/02/skos/core#">\n';
   skos += '  <rdf:Description rdf:about="' + conceptobj.uri + '"/>\n';
   skos += '    <rdf:type rdf:resource="http://www.w3.org/2004/02/skos/core#Concept"/>\n';
   skos += '    <skos:inScheme rdf:resource="' + getVocURI() + '"/>\n'
   skos += '    <skos:prefLabel>' + conceptobj.preflabel + '</skos:prefLabel>\n';
   skos += '    <skos:altLabel>' + conceptobj.altlabel + '</skos:altLabel>\n';
   for (i=0; i<conceptobj.broaders.length; i++) {
      skos += '    <skos:broader rdf:resource="' + conceptobj.broaders[i].uri + '"/>\n';  }
   for (i=0; i<conceptobj.narrowers.length; i++) {
      skos += '    <skos:narrower rdf:resource="' + conceptobj.narrowers[i].uri + '"/>\n';  }
   for (i=0; i<conceptobj.relateds.length; i++) {
      skos += '    <skos:related rdf:resource="' + conceptobj.relateds[i].uri + '"/>\n';  }
   //skos += '    <skos:scopeNote>' + conceptobj.notes + '</skos:scopeNote>\n';
   skos += '    <skos:scopeNote>' + notes + '</skos:scopeNote>\n';
   skos += '  </rdf:Description>\n';
   skos += '</rdf:RDF>\n';
   return skos;
}

function formatConceptInfoAsDublinCore() {
   formatView = 'dublincore';
   var cv = document.querySelector('#conceptview');
   var clv = document.querySelector('#conceptlistview');
   clv.style.display = 'none';
   var pre = document.querySelector('#pre-format');
   if (pre != null)
      cv.removeChild(pre);

   setFormatSelection(document.querySelector('#dc-button'));
   document.querySelector('#save-button').style.display = 'block';

   var dc = generateDublinCoreForConcept(currentConceptJson);

   var pre = document.createElement('pre');
   pre.setAttribute('id', 'pre-format');
   pre.appendChild(document.createTextNode(dc));
   cv.appendChild(pre);
}

function generateDublinCoreForConcept() {
   var conceptobj = JSON.parse(currentConceptJson);
   notes = wrapNotes(conceptobj.notes);
   var dc = '';
   dc += '<metadata\n';
   dc += '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
   dc += '  xmlns:dc="http://purl.org/dc/elements/1.1/"\n';
   dc += '  xmlns:dcterms="http://purl.org/dc/terms/">\n';
   dc += '  <dc:creator>' + getVocURI() + '</dc:creator>\n';
   dc += '  <dc:subject>' + conceptobj.preflabel + '</dc:subject>\n';
   dc += '  <dc:identifier>' + conceptobj.uri + '</dc:identifier>\n';
   dc += '  <dc:alternative>' + conceptobj.altlabel + '</dc:alternative>\n';
   dc += '  <dc:description>' + notes + '</dc:description>\n';
   for (i=0; i<conceptobj.broaders.length; i++) {
      dc += '  <dc:relation type="BroaderThan">' + conceptobj.broaders[i].uri + '</dc:relation>\n';  }
   for (i=0; i<conceptobj.narrowers.length; i++) {
      dc += '  <dc:relation type="NarrowerThan">' + conceptobj.narrowers[i].uri + '</dc:relation>\n';  }
   for (i=0; i<conceptobj.relateds.length; i++) {
      dc += '  <dc:relation type="RelatedTo">' + conceptobj.relateds[i].uri + '</dc:relation>\n';  }
   dc += '</metadata>\n';
   return dc;
}

function formatConceptInfoAsXML() {
   formatView = 'xml';
   var cv = document.querySelector('#conceptview');
   var clv = document.querySelector('#conceptlistview');
   clv.style.display = 'none';
   var pre = document.querySelector('#pre-format');
   if (pre != null)
      cv.removeChild(pre);

   setFormatSelection(document.querySelector('#xml-button'));
   document.querySelector('#save-button').style.display = 'block';

   var xml = generateXMLforConcept();

   var pre = document.createElement('pre');
   pre.setAttribute('id', 'pre-format');
   pre.appendChild(document.createTextNode(xml));
   cv.appendChild(pre);
}

function generateXMLforConcept() {
   var conceptobj = JSON.parse(currentConceptJson);
   notes = wrapNotes(conceptobj.notes);
   var xml = '<?xml version="1.0"?>\n';
   xml += '<metadata\n';
   xml += '  <scheme>' + getVocURI() + '</scheme>\n';
   xml += '  <concept>' + conceptobj.preflabel + '</concept>\n';
   xml += '  <uri>' + conceptobj.uri + '</uri>\n';
   xml += '  <alternate>' + conceptobj.altlabel + '</alternate>\n';
   xml += '  <notes>' + notes + '</notes>\n';
   xml += '  <broader>\n';
   for (i=0; i<conceptobj.broaders.length; i++) {
      xml += '    <uri>' + conceptobj.broaders[i].uri + '</uri>\n';  }
   xml += '  </broader>\n';
   xml += '  <narrower>\n';
   for (i=0; i<conceptobj.narrowers.length; i++) {
      xml += '    <uri>' + conceptobj.narrowers[i].uri + '</uri>\n';  }
   xml += '  </narrower>\n';
   xml += '  <related>\n';
   for (i=0; i<conceptobj.relateds.length; i++) {
      xml += '    <uri>' + conceptobj.relateds[i].uri + '</uri>\n';  }
   xml += '  </related>\n';
   xml += '</metadata>\n';
   return xml;
}

function formatConceptInfoAsList() {
    formatView = 'list';
    var cv = document.querySelector('#conceptview');
    var pre = document.querySelector('#pre-format');
    if (pre != null)
       cv.removeChild(pre);

    var clv = document.querySelector('#conceptlistview');
    clv.style.display = 'block';

    setFormatSelection(document.querySelector('#list-button'));
    document.querySelector('#save-button').style.display = 'none';

    var obj = JSON.parse(currentConceptJson);
    document.querySelector("#preflabel").textContent = obj.preflabel;
    urivalue = document.querySelector("#uri");
    while (urivalue.hasChildNodes())  {   // clear previous URI and links
       urivalue.removeChild(urivalue.firstChild);  }
    if (currentVoc != 'lcsh' && currentVoc != 'mesh')
       urivalue.textContent = obj.uri;
    else {
       alink = document.createElement('a');
       alink.setAttribute("href", obj.uri);
       alink.setAttribute("target", "_blank")
       alink.textContent = obj.uri;
       urivalue.appendChild(alink);
    }
    document.querySelector("#altlabel").textContent = obj.altlabel;
    document.querySelector("#notes").textContent = obj.notes;

    createConceptListElements('#broader', obj.broaders, 'No broader concepts');
    createConceptListElements('#narrower', obj.narrowers, 'No narrower concepts');
    createConceptListElements('#related', obj.relateds, 'No related concepts');

    function createConceptListElements(selector, objvalues, novalues) {
       listelt = document.querySelector(selector);
       while (listelt.hasChildNodes())  {   // clear previous list
          listelt.removeChild(listelt.firstChild);  }

       var len = objvalues.length;
       if (len > 0) {
          ul = document.createElement('ul');
          ul.setAttribute("class", "nobullets");
          listelt.appendChild(ul);
          for (i=0; i<len; i++) {
             li = document.createElement('li');
             var span = document.createElement('span');
             li.appendChild(span);
             var label = document.createTextNode('   ' + objvalues[i].label);
             span.appendChild(label);
             span.setAttribute('class', 'linkedterm');
             var clickcall = "getConceptInfo('" + objvalues[i].uri + "', '" + currentVoc + "')";
             span.setAttribute('onclick', clickcall);
             ul.appendChild(li);
          }
       }
       else {
          listelt.textContent = novalues;
       }
    }
}

function setFormatSelection(selectedButton) {
   var formatButtons = [];
   formatButtons.push(document.querySelector('#list-button'));
   formatButtons.push(document.querySelector('#json-button'));
   formatButtons.push(document.querySelector('#skos-button'));
   formatButtons.push(document.querySelector('#dc-button'));
   formatButtons.push(document.querySelector('#xml-button'));
   for (i=0; i< formatButtons.length; i++) {
      formatButtons[i].removeAttribute('class', 'selected-button');
      formatButtons[i].setAttribute('class', 'unselected-button');
   }

   selectedButton.removeAttribute('class', 'unselected-button');
   selectedButton.setAttribute('class', 'selected-button');
}

