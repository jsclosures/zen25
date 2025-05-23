# zen25
ZEN 2025 standalone

curl -X POST -H 'Content-type:application/json'  http://localhost:8983/solr/tagger/schema -d '{
  "add-field-type":{
    "name":"tag",
    "class":"solr.TextField",
    "postingsFormat":"FST50",
    "omitNorms":true,
    "omitTermFreqAndPositions":true,
    "indexAnalyzer":{
      "tokenizer":{
         "class":"solr.StandardTokenizerFactory" },
      "filters":[
        {"class":"solr.EnglishPossessiveFilterFactory"},
        {"class":"solr.ASCIIFoldingFilterFactory"},
        {"class":"solr.LowerCaseFilterFactory"},
        {"class":"solr.ConcatenateGraphFilterFactory", "preservePositionIncrements":false }
      ]},
    "queryAnalyzer":{
      "tokenizer":{
         "class":"solr.StandardTokenizerFactory" },
      "filters":[
        {"class":"solr.EnglishPossessiveFilterFactory"},
        {"class":"solr.ASCIIFoldingFilterFactory"},
        {"class":"solr.LowerCaseFilterFactory"}
      ]}
    },

  "add-field":{"name":"tagger_text", "type":"tag", "stored":false,"multiValued": true }
}'



curl -X POST -H 'Content-type:application/json' http://localhost:8983/solr/tagger/config -d '{
  "add-requesthandler" : {
    "name": "/tag",
    "class":"solr.TaggerRequestHandler",
    "defaults":{"field":"tagger_text"}
  }
}'


[
    {
        "id": "INTENT1",
        "type_s": "INTENT",
        "tagger_text": ["find doctor"],
        "output_s": ["FINDDOCTOR"]
     },
     {
        "id": "INTENT2",
        "type_s": "INTENT",
        "tagger_text": ["find"],
        "output_s": ["FIND"]
     },
     {
        "id": "SPECIALTY1",
        "type_s": "SPECIALTY",
        "tagger_text": ["knee"],
        "output_s": ["KNEE"]
     },
     {
        "id": "SPECIALTY2",
        "type_s": "SPECIALTY",
        "tagger_text": ["wrist"],
        "output_s": ["WRIST"]
     }
]


"FINDDOCTOR" : {
        "action" : "GET",
        "score": 1,
        "response" : [
            "@SLOT.name is a doctor",
            "@SLOT.name might be able to help"
        ],
        "failedResponse" : [
            "@SLOT.name can't be found",
            "@SLOT.name is missing"
        ],
        "grammar" : [
            {
                "text" : "find doctor",
                "condition" : "contains"
            },
            {
                "text" : "find physcian",
                "condition" : "contains"
            },
            {
                "text" : "get help",
                "condition" : "contains"
            }
        ],
        "field" : [
            {
                "name" : "name",
                "type" : "text",
                "required": true,
                "directive" : [
                    "what specialy are you needing",
                    "what kind of procedure are you looking for"
                ]
            }
        ]
    }