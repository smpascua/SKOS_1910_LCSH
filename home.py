import cherrypy #webserver
import os
import sqlite3
import sys
import io
import requests
sys.path.append(os.path.dirname(__file__))
from operator import attrgetter
from nltk.stem.porter import PorterStemmer
import RAKE
from urllib import request
from bs4 import BeautifulSoup
import PyPDF2
import docx

stoppath = os.path.join(os.path.dirname(__file__), "SmartStoplist.txt")
stop = set()
stemmer = PorterStemmer()
json_out = None
maxWordsPerPhrase = 2  # default
maxResults = 50  # default

class HiveHome:
    @cherrypy.expose #define ng path using pathname function
    def index(self):
        homePage = os.path.join(os.path.dirname(__file__), 'home.html')
        return open(homePage)


    @cherrypy.expose
    def search(self):
        searchPage = os.path.join(os.path.dirname(__file__), 'search.html')
        return open(searchPage)


    @cherrypy.expose
    def indexer(self):
        indexPage = os.path.join(os.path.dirname(__file__), 'indexer.html')
        return open(indexPage)


    @cherrypy.expose
    def getAvailableVocabularies(self):
        db = db_connect("vocabulary")
        results = generateVocabularyList(db)
        cherrypy.request.app.log('Voc list: ' + str(results))
        db.close()
        return results


    @cherrypy.expose
    def getTopConcepts(self, voc, search):
        results = getTopConceptsList(voc, search)
        return results


    @cherrypy.expose
    def getNarrowerConcepts(self, voc, uri):
        results = getNarrowerConceptsList(voc, uri)
        return results


    @cherrypy.expose
    def getConceptInfo(self, id, voc):
        db = db_connect(voc)
        results = getConcept(id, db)
        db.close()
        return results


    @cherrypy.expose
    def searchForConcept(self, term, vocs):
        vocsToSearch = vocs.split(',')
        # normalize and stem the search term
        termdict = {}
        termsToSearch = term.split('+')
        # use normalizedTerm to recreate normalized terms, separated by +, to create a one-entry dictionary
        # so can reuse findKeywordsWithVocabulary function
        normalizedTerm = ''
        for t in termsToSearch:
            t.strip().lower()
            t = stemmer.stem(t)
            normalizedTerm = normalizedTerm + t + '+'
        normalizedTerm = normalizedTerm[:-1]
        termdict[normalizedTerm] = 0

        results = ''
        for v in vocsToSearch:
            voc_concepts = findKeywordsWithVocabulary(v, termdict, 'search')
            if len(voc_concepts) > 0:
                results = results + generateJSON(v, voc_concepts) # , False)
        if results.endswith(','):
           results = results[:-1]
        results = "[" + results + "]"
        return results


    @cherrypy.expose
    def generateIndex(self, url, vocs, parms):
        global maxWordsPerPhrase
        global maxResults
        vocsForIndexing = vocs.split(',')
        parmsForIndexing = parms.split(',')
        # cherrypy.request.app.log(str(values))
        normalizedKeywords, urlError = extractKeywords(url, parmsForIndexing)
        print("Normalized keywords: ", len(normalizedKeywords), "\n", normalizedKeywords, "\n")
        maxResults = 0
        if len(parmsForIndexing) == 4:
            if parmsForIndexing[3].isnumeric():
                maxResults = int(parmsForIndexing[3])
            if parmsForIndexing[1].isnumeric():
                maxWordsPerPhrase = int(parmsForIndexing[1])

        if not urlError:   #  no URL error found
            results = ''
            for v in vocsForIndexing:
                voc_concepts = findKeywordsWithVocabulary(v, normalizedKeywords, 'match')
                # TEST (too many results) voc_concepts = findKeywordsWithVocabulary(v, normalizedKeywords, 'search')

                if maxResults > 0 and maxResults < len(voc_concepts):
                    voc_concepts = voc_concepts[0:maxResults]

                if len(voc_concepts) > 0:
                    print("Voc Concepts: ", len(voc_concepts), "\n", voc_concepts, "\n")
                    results = results + generateJSON(v, voc_concepts) # , True)  # new
            if results.endswith(','):
                results = results[:-1]
            results = "[" + results + "]"
        else:
            results = "urlError"
        # cherrypy.log(results)
        return results


    @cherrypy.expose
    def upload(self, docfile):
        try:
            try:
                tempdir = os.path.join(os.path.dirname(__file__), 'temp')
                if not os.path.exists(tempdir):
                    os.makedirs(tempdir)
            except OSError:
                print('Error: Creating directory. ' + tempdir)

            newfilename = os.path.join(tempdir, docfile.filename)
            with open(newfilename, 'wb') as newfile:
                size = 0
                while True:
                    data = docfile.file.read(8192)
                    if not data:
                        break
                    size += len(data)
                    newfile.write(data)
        except Exception as err:
            print(err)
            print('A file error occurred in upload')


def generateVocabularyList(db):
    results = ''
    sql = 'SELECT * FROM VOCABULARY ORDER BY LongName'
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        clen = len(rows)
        i = 1
        if len(rows) > 0:
            results += '{"vocs": ['
            for c in rows:
                if i < clen:
                    results += '{"name": "' + c[0] + '", "longname": "' + c[1] + '", "uri": "' + c[2] + '", "numConcepts": "' + str(c[3]) + '", "lastUpdated": "' + str(c[4]) + '"},'
                else:
                    results += '{"name": "' + c[0] + '", "longname": "' + c[1] + '", "uri": "' + c[2] + '", "numConcepts": "' + str(c[3]) + '", "lastUpdated": "' + str(c[4]) + '"}'
                i +=1
            results += '] }'
        else:
            results += '"vocs": []'
        print(results)
        return results
    except sqlite3.IntegrityError as err:
        print('Integrity Error in generateVocabularyList')
    except sqlite3.OperationalError as err:
        print('Operational Error in generateVocabularyList')
    except sqlite3.Error as err:
        print('Error in generateVocabularyList')


def getTopConceptsList(voc, searchterm):
    db = db_connect(voc)
    if voc == "lcsh" or voc == "mesh":
        sql = 'SELECT * FROM CONCEPT WHERE PrefLabel LIKE "' + searchterm + '%" ORDER BY PrefLabel LIMIT 100'
    else:
        sql = 'SELECT * FROM CONCEPT WHERE TopConcept = 1 ORDER BY PrefLabel'
    try:
        results = ''
        voc_concepts = []
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        if len(rows) > 0:
            for concept in rows:
                num_narrowers = getNumberOfNarrowers(voc, concept[0])
                c = Concept(voc, concept[0], concept[1], concept[5], num_narrowers)
                voc_concepts.append(c)
            results = results + generateJSON(voc, voc_concepts) # , False)
            if results.endswith(','):
                results = results[:-1]
            results = "[" + results + "]"
        db.close()
        return results
    except sqlite3.IntegrityError as err:
        print('Integrity Error in generateTopConceptList')
    except sqlite3.OperationalError as err:
        print('Operational Error in generateTopConceptList')
    except sqlite3.Error as err:
        print('Error in generateTopConceptList')


def getNarrowerConceptsList(voc, uri):
    db = db_connect(voc)
    sql = "SELECT * FROM CONCEPT, BROADERS WHERE BROADERS.ConceptURI ='" + uri + "' AND BroaderThanURI = CONCEPT.ConceptURI ORDER BY PrefLabel"
    # print(sql)
    try:
        results = ''
        voc_concepts = []
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        if len(rows) > 0:
            for concept in rows:
                num_narrowers = getNumberOfNarrowers(voc, concept[0])
                c = Concept(voc, concept[0], concept[1], concept[5], num_narrowers)
                voc_concepts.append(c)
            results = results + generateJSON(voc, voc_concepts) # , False)
            if results.endswith(','):
                results = results[:-1]
            results = "[" + results + "]"
        db.close()
        return results
    except sqlite3.IntegrityError as err:
        print('Integrity Error in generateTopConceptList')
    except sqlite3.OperationalError as err:
        print('Operational Error in generateTopConceptList')
    except sqlite3.Error as err:
        print('Error in generateTopConceptList')


def getNumberOfNarrowers(voc, uri):
    db = db_connect(voc)
    sql = 'SELECT COUNT(*) FROM BROADERS WHERE ConceptURI = ' + '"' + uri + '"'
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchone()
        db.close()
        return rows[0]
    except sqlite3.IntegrityError as err:
        print('Integrity Error in hasNarrowers')
    except sqlite3.OperationalError as err:
        print('Operational Error in hasNarrowers')
    except sqlite3.Error as err:
        print('Error in hasNarrowers')


def getChildren(concept, db):
    global json_out
    sql = "SELECT BroaderThanURI, PrefLabel FROM CONCEPT, BROADERS WHERE BROADERS.ConceptURI = " + "'" + concept + "' AND BROADERS.BroaderThanURI = CONCEPT.ConceptURI ORDER BY PrefLabel"
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        return rows
    except sqlite3.IntegrityError as err:
        print('Integrity Error in getBroaderThans')
    except sqlite3.OperationalError as err:
        print('Operational Error in getBroaderThans')
    except sqlite3.Error as err:
        print('Error in getBroaderThans')


def generateTopConceptHierarchy(db):
    global json_out
    sql = 'SELECT * FROM CONCEPT WHERE TopConcept = 1 ORDER BY PrefLabel'
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        i = 1
        hier_data = ''
        if len(rows) > 0:
            hier_data = hier_data + '<div id="tree"><ul id="voclist">'

            for c in rows:
                hier_data = hier_data + '<li  id="' + c[0] + '">' + c[1]
                broad_data = getBroaderThans(c[0], 1, db)
                hier_data = hier_data + broad_data
                hier_data = hier_data + '</li>'
            hier_data = hier_data + '</ul></div>'
        return hier_data
    except sqlite3.IntegrityError as err:
        print('Integrity Error in generateTopConceptHierarchy')
    except sqlite3.OperationalError as err:
        print('Operational Error in generateTopConceptHierarchy')
    except sqlite3.Error as err:
        print('Error in generateTopConceptHierarchy')


def getBroaderThans(concept, indent, db):
    global json_out
    sql = "SELECT PrefLabel, BroaderThanURI FROM CONCEPT, BROADERS WHERE BROADERS.ConceptURI = " + "'" + concept + "' AND BROADERS.BroaderThanURI = CONCEPT.ConceptURI ORDER BY PrefLabel"
    # print(sql)
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        broad_data = ''
        if len(rows) > 0:
            broad_data = broad_data + '<ul>'
            for c in rows:
                broad_data = broad_data + '<li id="' + c[1] + '">' + c[0]
                broad_data = broad_data + getBroaderThans(c[1], indent+1, db)
                broad_data = broad_data + '</li>'
            broad_data = broad_data + '</ul>'
        return broad_data
    except sqlite3.IntegrityError as err:
        print('Integrity Error in getBroaderThans')
    except sqlite3.OperationalError as err:
        print('Operational Error in getBroaderThans')
    except sqlite3.Error as err:
        print('Error in getBroaderThans')


def getConcept(id, db):
    sql = 'SELECT * FROM CONCEPT WHERE ConceptURI = "' + id + '"'
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        if len(rows) > 0:
            for c in rows:
                uri = c[0]
                prefLabel = c[1]
                if c[2] is None:
                    altLabel = 'Not provided'
                else:
                    altLabel = c[2]
                if c[3] is None:
                    scopeNotes = 'Not provided'
                else:
                    scopeNotes = c[3]
                if c[4] == 0 :
                    topConcept = 'false'
                else:
                    topConcept = 'true'
                results = '{"preflabel": "' + prefLabel + '", "uri": "' + uri + '", "altlabel": "' + altLabel
                results += '", "notes": "' + scopeNotes + '", "topconcept": "' + topConcept + '"'
                broaders = getBroadersForConcept(c[0], db)
                narrowers = getNarrowersForConcept(c[0], db)
                relateds = getRelatedsForConcept(c[0], db)
                results += ', ' + broaders + ', ' + narrowers + ', ' + relateds + '}'

                # cherrypy.log(results)
                return results
        else:
            return "Unable to find concept: " + id
    except sqlite3.IntegrityError as err:
        print('Integrity Error in getConcept')
    except sqlite3.OperationalError as err:
        print('Operational Error in getConcept')
    except sqlite3.Error as err:
        print('Error in getConcept')


def getBroadersForConcept(concept, db):
    results = ''
    sql = "SELECT CONCEPT.PrefLabel, BROADERS.ConceptURI FROM CONCEPT, BROADERS WHERE BROADERS.BroaderThanURI = " + "'" + concept + "' AND BROADERS.ConceptURI = CONCEPT.ConceptURI ORDER BY PrefLabel"
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        clen = len(rows)
        i = 1
        if len(rows) > 0:
            results += '"broaders": ['
            for c in rows:
                if i < clen:
                    results += '{"label": "' + c[0] + '", "uri": "' + c[1] + '"},'
                else:
                    results += '{"label": "' + c[0] + '", "uri": "' + c[1] + '"}'
                i += 1
            results += ']'
        else:
            results += '"broaders": []'
        return results
    except sqlite3.IntegrityError as err:
        print('Integrity Error in getBroadersForConcept')
    except sqlite3.OperationalError as err:
        print('Operational Error in getBroadersForConcept')
    except sqlite3.Error as err:
        print('Error in getBroadersForConcept')


def getNarrowersForConcept(concept, db):
    results = ''
    sql = "SELECT CONCEPT.PrefLabel, BROADERS.BroaderThanURI FROM CONCEPT, BROADERS WHERE BROADERS.ConceptURI = " + "'" + concept + "' AND BROADERS.BroaderThanURI = CONCEPT.ConceptURI ORDER BY PrefLabel"
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        clen = len(rows)
        i = 1
        if len(rows) > 0:
            results += '"narrowers": ['
            for c in rows:
                if i < clen:
                    results += '{"label": "' + c[0] + '", "uri": "' + c[1] + '"},'
                else:
                    results += '{"label": "' + c[0] + '", "uri": "' + c[1] + '"}'
                i +=1
            results += ']'
        else:
            results += '"narrowers": []'
        return results
    except sqlite3.IntegrityError as err:
        print('Integrity Error in getNarrowersForConcept')
    except sqlite3.OperationalError as err:
        print('Operational Error in getNarrowersForConcept')
    except sqlite3.Error as err:
        print('Error in getNarrowersForConcept')


def getRelatedsForConcept(concept, db):
    results = ''
    sql = "SELECT CONCEPT.PrefLabel, RELATED.RelatedURI FROM CONCEPT, RELATED WHERE RELATED.ConceptURI = " + "'" + concept + "' AND RELATED.RelatedURI = CONCEPT.ConceptURI ORDER BY PrefLabel"
    try:
        cursor = db.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        clen = len(rows)
        i = 1
        if len(rows) > 0:
            results += '"relateds": ['
            for c in rows:
                if i < clen:
                    results += '{"label": "' + c[0] + '", "uri": "' + c[1] + '"},'
                else:
                    results += '{"label": "' + c[0] + '", "uri": "' + c[1] + '"}'
                i += 1
            results += ']'
        else:
            results += '"relateds": []'
        return results
    except sqlite3.IntegrityError:
        print('Integrity Error in getRelatedsForConcept')
    except sqlite3.OperationalError:
        print('Operational Error in getRelatedsForConcept')
    except sqlite3.Error:
        print('Error in getRelatedsForConcept')


def generateJSON(voc, concepts): # , limitConcepts):
    clen = len(concepts)
    jsonstring = '{"voc": "' + voc + '" , "concepts":['
    for i in range(clen):
        preflabel = concepts[i].prefLabel.replace('"', "'")
        if i < clen-1:
            jsonstring = jsonstring + '{"prefLabel":"' + preflabel + '", "uri":"' + str(concepts[i].uri) + '", "score":"' + str(concepts[i].score) + '" },'
        else:
            jsonstring = jsonstring + '{"prefLabel":"' + preflabel + '", "uri":"' + str(concepts[i].uri) + '", "score":"' + str(concepts[i].score) + '" }'
    jsonstring = jsonstring + ']},'
    return jsonstring


class Concept:
    def __init__(self, voc, uri, prefLabel, normPrefLabel, score):
        self.vocabularyName = voc
        self.uri = uri
        self.prefLabel = prefLabel
        self.normPrefLabel = normPrefLabel
        self.score = score
    def __repr__(self):
        return repr((self.uri, self.prefLabel, self.normPrefLabel, self.score))


class TreeNode:
    def __init__(self, uri, prefLabel, depth):
        self.uri = uri
        self.prefLabel = prefLabel
        self.depth = depth
    def __repr__(self):
        return repr((self.uri, self.prefLabel, self.depth))


def extractKeywords(docurl, parms):
    # print('extractKeywords arg = ' + docurl)
    global voc
    # initialize RAKE and specify parameters:
    #  -- least number of chars per word
    #  -- phrase has at most n words
    #  -- keyword appears at least n times
    # rake_object = rake.Rake(stoppath, 3,3,2)  # 5,3,4)
    rake_object = RAKE.Rake(stoppath, int(parms[0]), int(parms[1]), int(parms[2]))  # 5,3,4)

    normalizedKeywords = {}
    urlError = False
    text = getURLcontents(docurl)
    if text:     # no exception, some text was returned
        keywords = rake_object.run(text)
        print("RAKE Extracted keywords: ", len(keywords), "\n", keywords, "\n")

        # To improve performance: when a large number of extracted keywords are found
        # (typically in a large file), only use at most the first 500 extracted keywords.
        # This will help speed up the findKeywordsWithvocabulary processing.
        # If > 500 RAKE keywords returned, only use the first 500
        if len(keywords) > 500:
            keywords = keywords[0:499]

        # Create new dictionary with normalized keywords and scores
        for k in keywords:
            normKw = normalize(k[0])
            normalizedKeywords[normKw] = k[1]
        return normalizedKeywords, False
    else:
        return normalizedKeywords, True


def findKeywordsWithVocabulary(voc, normalizedKeywords, findType):
    matchedConcepts = []
    matchedKw = {}
    for k in normalizedKeywords:
        concepts = inVocabulary(voc, k, findType) # if normalized keyword (or search item) found in vocabulary database, return rows
        if concepts:
            for concept in concepts:
                terms = concept[1].split()  # create list of terms in concept, separated by space
                if len(terms) <= maxWordsPerPhrase: # if PrefLabel has more words than index filter, discard
                    c = Concept(voc, concept[0], concept[1], concept[5], normalizedKeywords[k])
                    matchedConcepts.append(c)
                    matchedKw[k] = normalizedKeywords[k]

    # Below sorts alphabetically by prefLabel
    # sortByPrefLabel = sorted(matchedConcepts, key=attrgetter('prefLabel'))
    # return sortByPrefLabel

    if findType == 'match':
        # Modified so results are in descending score order (highest score first)
        sortedConcepts = sorted(matchedConcepts, key=attrgetter('score'), reverse=True)

        # jpb: return in score order, only the first maxResults
        if len(sortedConcepts) > maxResults:
            maxSortedConcepts = sortedConcepts[0:maxResults]
            sortedConcepts = maxSortedConcepts

    else: # findType = 'search', sort by prefLabel
        sortedConcepts = sorted(matchedConcepts, key=attrgetter('prefLabel'))

    return sortedConcepts


def getURLcontents(docurl):
    # print('getURLcontents for ' + docurl)
    pdfFileObj = None
    input_file= None
    try:
        if docurl.startswith('http'):
            # Reference: https://stackoverflow.com/questions/45470964/python-extracting-text-from-webpage-pdf
            if docurl.endswith('.pdf'):
                r = requests.get(docurl)
                f = io.BytesIO(r.content)
                pdfReader = PyPDF2.PdfFileReader(f)
                text = ''
                for num in range(pdfReader.numPages):
                    text += pdfReader.getPage(num).extractText()
            else: # basic html page
                html = request.urlopen(docurl).read().decode('utf8')
                text = BeautifulSoup(html,"html.parser").get_text()
            # print(text)
            return text
        else:
            tempdir = os.path.join(os.path.dirname(__file__), 'temp')
            docurl = os.path.join(tempdir, docurl)
            # Source: https://automatetheboringstuff.com/chapter13/
            if docurl.endswith(".pdf"):
                pdfFileObj = open(docurl, 'rb')
                pdfReader = PyPDF2.PdfFileReader(pdfFileObj)
                text = ''
                for num in range(pdfReader.numPages):
                    text += pdfReader.getPage(num).extractText()
            elif docurl.endswith(".docx"):
                doc = docx.Document(docurl)
                text = []
                for para in doc.paragraphs:
                    text.append(para.text)
                text = '\n'.join(text)
                # appears docx closes the file for you
            else:   # assume a plain text file
                # surrogateescape will ignore some encoding errors,
                input_file = open(docurl, 'r', encoding="latin-1") #  , errors="surrogateescape")
                text = input_file.read()
            return text
    except ValueError as err:
        print('Value Error occurred in getURLcontents for: ', docurl, '\n Exception: ', err)
        return False
    except OSError as err:
        print('OSError occurred in getURLcontents for: ', docurl, '\n Exception: ', err)
        return False
    except Exception as err:  # an exception was raised, but not one of the above
        print('Error occurred in getURLcontents for: ', docurl, '\n Exception: ', err)
        return False
    finally:  # clean up: ensure uploaded file is deleted from temp dir
        try:
            if pdfFileObj:
                pdfFileObj.close()
            if input_file:
                input_file.close()
            if not docurl.startswith('http'):  # no need to delete if remote (http)
                os.remove(docurl)
        except Exception as err:
            print('os.remove error: ', err)


def createStopwordsList():
    global stop
    global stoppath
    stop_word_file = stoppath
    stop_words = []
    for line in open(stop_word_file):
        if line.strip()[0:1] != "#":
            for word in line.split():  # in case more than one per line
                stop_words.append(word)
    stop = set(stop_words)


def normalize(kw):
    global stop
    createStopwordsList()
    kw = kw.lower()
    kwList = kw.split(" ")
    stopfree_words = [word for word in kwList if word not in stop]
    stoppedAndStemmed = stemList(stopfree_words)
    space = ' '
    normKw = space.join(stoppedAndStemmed)
    return normKw


def stemList(wordList):
    global stemmer
    stemmed = []
    for word in wordList:
        stemmedword = stemmer.stem(word)
        stemmed.append(stemmedword)
    return stemmed


def inVocabulary(voc, keyphrase, findType):
    db = db_connect(voc)
    if db:
        if findType == 'match':
            termsToSearch = keyphrase.split()  # when indexing, space separates multi-word phrases
            sql = "SELECT * FROM CONCEPT WHERE "
            if len(termsToSearch) == 1:
                term = termsToSearch[0]
                sql = "SELECT * FROM CONCEPT WHERE NormPrefLabel='" + term + "'"
            else:
                for term in termsToSearch:
                    sql += "NormPrefLabel LIKE '%" + term + "%' AND "
                sql = sql[:-4]
        else:  # findType = 'search'; keyphrase format: term, term+term, term+term+term, etc
            termsToSearch = keyphrase.split('+')
            sql = "SELECT * FROM CONCEPT WHERE "
            for term in termsToSearch:
                 sql += "NormPrefLabel LIKE '%" + term + "%' AND "
            sql = sql[:-4]
        try:
            cursor = db.cursor()
            cursor.execute(sql)
            rows = cursor.fetchall()
            # print(sql, len(rows))
            if len(rows) > 0:
                return rows
            else:
                return False
        except sqlite3.IntegrityError:
            print('Integrity Error in inVocabulary')
        except sqlite3.OperationalError:
            print('Operational Error in inVocabulary' + ' ' + sql)
        except sqlite3.Error:
            print('Error in inVocabulary')


def db_connect(voc):
    dbname = 'db/' + voc.lower() + '.db'
    dbname = os.path.join(os.path.dirname(__file__), dbname)
    try:
        if os.path.exists(dbname):
            db = sqlite3.connect(dbname)
            return db
        else:
            print('Error: ' +  dbname + ' does not exist')
    except sqlite3.IntegrityError:
        print('Integrity Error in db_connect')
    except sqlite3.OperationalError:
        print('Operational Error in db_connect')
    except sqlite3.Error:
        print('Error in db_connect')
    return False

conf = {'/':
        {
            'tools.sessions.on': True,
            'tools.staticdir.root': os.path.abspath(os.getcwd()),
            # 'tools.staticdir.root': bundle_dir,
            'cors.expose.on': True
        },
     'global': 
        { 
            'server.socket_host': '127.0.0.1',
            # REMOTE  'server.socket_host': 'hive2.cci.drexel.edu',
            'server.socket_port': 8080,
            'server.thread_pool': 10
        },  
     '/static':
        { 
            'tools.staticdir.on': True,
            'tools.staticdir.dir': './public'
            # REMOTE  'tools.staticdir.dir': 'site-packages/cherrypy/HIVE2a/public' ,
        }            
    }

access_log = os.path.join(os.path.dirname(__file__), "access.log")
error_log = os.path.join(os.path.dirname(__file__), "error.log")
cherrypy.config.update({'log.screen': False, 'log.error_file': error_log, 'log.access_file': access_log})

import cherrypy_cors    # CORS

if __name__ == '__main__':
    cherrypy_cors.install()      # CORS: Cross-origin resource support
    cherrypy.quickstart(HiveHome(), config=conf)