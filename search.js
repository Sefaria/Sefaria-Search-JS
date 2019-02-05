const $ = require('./sefariaJquery');
const extend            = require('extend');
const FilterNode = require('./FilterNode');
const SearchState = require('./searchState');

class Search {
    constructor(searchIndexText, searchIndexSheet) {
      this.searchIndexText = searchIndexText;
      this.searchIndexSheet = searchIndexSheet;
      this._cache = {}
    }
    cache(key, result) {
        if (result !== undefined) {
           this._cache[key] = result;
        }
        return this._cache[key];
    }
    execute_query(args) {
        // To replace sjs.search.post in search.js

        /* args can contain
         query: query string
         size: size of result set
         start: from what result to start
         type: "sheet" or "text"
         applied_filters: filter query by these filters
         appliedFilterAggTypes: array of same len as applied_filters giving aggType for each filter
         field: field to query in elastic_search
         sort_type: See SearchState.metadataByType for possible sort types
         exact: if query is exact
         success: callback on success
         error: callback on error
         */
        if (!args.query) {
            return;
        }
        var req = JSON.stringify(this.get_query_object(args));
        var cache_result = this.cache(req);
        if (cache_result) {
            args.success(cache_result);
            return null;
        }
        return $.ajax({
            url: `${Sefaria.apiHost}/api/search-wrapper`,
            type: 'POST',
            data: req,
            contentType: "application/json; charset=utf-8",
            crossDomain: true,
            processData: false,
            dataType: 'json',
            success: function(data) {
                this.cache(req, data);
                args.success(data);
            }.bind(this),
            error: args.error
        });
    }
    get_query_object({
      query,
      applied_filters,
      appliedFilterAggTypes,
      aggregationsToUpdate,
      size,
      start,
      type,
      field,
      sort_type,
      exact
    }) {
      const { sortTypeArray, aggregation_field_array } = SearchState.metadataByType[type];
      const { sort_method, fieldArray, score_missing, direction } = sortTypeArray.find( x => x.type === sort_type );
      return {
        type,
        query,
        field,
        source_proj: true,
        slop: exact ? 0 : 10,
        start,
        size,
        filters: applied_filters.length ? applied_filters : [],
        filter_fields: appliedFilterAggTypes,
        aggs: aggregationsToUpdate,
        sort_method,
        sort_fields: fieldArray,
        sort_reverse: direction === "desc",
        sort_score_missing: score_missing,
      };
    }

    process_text_hits(hits) {
      var newHits = [];
      var newHitsObj = {};  // map ref -> index in newHits
      for (var i = 0; i < hits.length; i++) {
        let currRef = hits[i]._source.ref;
        let newHitsIndex = newHitsObj[currRef];
        if (typeof newHitsIndex != "undefined") {
          newHits[newHitsIndex].duplicates = newHits[newHitsIndex].duplicates || [];
          newHits[newHitsIndex].insertInOrder(hits[i], (a, b) => a._source.version_priority - b._source.version_priority);
        } else {
          newHits.push([hits[i]])
          newHitsObj[currRef] = newHits.length - 1;
        }
      }
      newHits = newHits.map(hit_list => {
        let hit = hit_list[0];
        if (hit_list.length > 1) {
          hit.duplicates = hit_list.slice(1);
        }
        return hit;
      });
      return newHits;
    }
    buildFilterTree(aggregation_buckets, appliedFilters) {
      //returns object w/ keys 'availableFilters', 'registry'
      //Add already applied filters w/ empty doc count?
      var rawTree = {};

      appliedFilters.forEach(
          fkey => this._addAvailableFilter(rawTree, fkey, {"docCount":0})
      );

      aggregation_buckets.forEach(
          f => this._addAvailableFilter(rawTree, f["key"], {"docCount":f["doc_count"]})
      );
      this._aggregate(rawTree);
      return this._build(rawTree);
    }
    _addAvailableFilter(rawTree, key, data) {
      //key is a '/' separated key list, data is an arbitrary object
      //Based on http://stackoverflow.com/a/11433067/213042
      var keys = key.split("/");
      var base = rawTree;

      // If a value is given, remove the last name and keep it for later:
      var lastName = arguments.length === 3 ? keys.pop() : false;

      // Walk the hierarchy, creating new objects where needed.
      // If the lastName was removed, then the last object is not set yet:
      var i;
      for(i = 0; i < keys.length; i++ ) {
          base = base[ keys[i] ] = base[ keys[i] ] || {};
      }

      // If a value was given, set it to the last name:
      if( lastName ) {
          base = base[ lastName ] = data;
      }

      // Could return the last object in the hierarchy.
      // return base;
    }
    _aggregate(rawTree) {
      //Iterates the raw tree to aggregate doc_counts from the bottom up
      //Nod to http://stackoverflow.com/a/17546800/213042
      walker("", rawTree);
      function walker(key, branch) {
          if (branch !== null && typeof branch === "object") {
              // Recurse into children
              $.each(branch, walker);
              // Do the summation with a hacked object 'reduce'
              if ((!("docCount" in branch)) || (branch["docCount"] === 0)) {
                  branch["docCount"] = Object.keys(branch).reduce(function (previous, key) {
                      if (typeof branch[key] === "object" && "docCount" in branch[key]) {
                          previous += branch[key].docCount;
                      }
                      return previous;
                  }, 0);
              }
          }
      }
    }

    _build(rawTree) {
      //returns dict w/ keys 'availableFilters', 'registry'
      //Aggregate counts, then sort rawTree into filter objects and add Hebrew using Sefaria.toc as reference
      //Nod to http://stackoverflow.com/a/17546800/213042
      var path = [];
      var filters = [];
      var registry = {};

      var commentaryNode = new FilterNode();


      for(var j = 0; j < Sefaria.search_toc.length; j++) {
          var b = walk.call(this, Sefaria.search_toc[j]);
          if (b) filters.push(b);

          // Remove after commentary refactor ?
          // If there is commentary on this node, add it as a sibling
          if (commentaryNode.hasChildren()) {
            var toc_branch = Sefaria.toc[j];
            var cat = toc_branch["category"];
            // Append commentary node to result filters, add a fresh one for the next round
            var docCount = 0;
            if (rawTree.Commentary && rawTree.Commentary[cat]) { docCount += rawTree.Commentary[cat].docCount; }
            if (rawTree.Commentary2 && rawTree.Commentary2[cat]) { docCount += rawTree.Commentary2[cat].docCount; }
            extend(commentaryNode, {
                "title": cat + " Commentary",
                "aggKey": "Commentary/" + cat,
                "heTitle": "מפרשי" + " " + toc_branch["heCategory"],
                "docCount": docCount
            });
            registry[commentaryNode.aggKey] = commentaryNode;
            filters.push(commentaryNode);
            commentaryNode = new FilterNode();
          }
      }

      return { availableFilters: filters, registry };

      function walk(branch, parentNode) {
          var node = new FilterNode();

          node["docCount"] = 0;

          if("category" in branch) { // Category node

            path.push(branch["category"]);  // Place this category at the *end* of the path
            extend(node, {
              "title": path.slice(-1)[0],
              "aggKey": path.join("/"),
              "heTitle": branch["heCategory"]
            });

            for(var j = 0; j < branch["contents"].length; j++) {
                var b = walk.call(this, branch["contents"][j], node);
                if (b) node.append(b);
            }
          }
          else if ("title" in branch) { // Text Node
              path.push(branch["title"]);
              extend(node, {
                 "title": path.slice(-1)[0],
                 "aggKey": path.join("/"),
                 "heTitle": branch["heTitle"]
              });
          }

          try {
              var rawNode = rawTree;
              var i;

              for (i = 0; i < path.length; i++) {
                //For TOC nodes that we don't have results for, we catch the exception below.
                rawNode = rawNode[path[i]];
              }
              node["docCount"] += rawNode.docCount;
              registry[node.aggKey] = node;
              path.pop();
              return node;
          }
          catch (e) {
            path.pop();
            return false;
          }
      }
    }

    applyFilters(registry, appliedFilters) {
      var orphans = [];  // todo: confirm behavior
      appliedFilters.forEach(aggKey => {
        var node = registry[aggKey];
        if (node) { node.setSelected(true); }
        else { orphans.push(aggKey); }
      });
      return orphans;
    }

    getAppliedSearchFilters(availableFilters) {
      let appliedFilters = [];
      let appliedFilterAggTypes = [];
      //results = results.concat(this.orphanFilters);
      for (let tempFilter of availableFilters) {
          const tempApplied = tempFilter.getAppliedFilters();
          const tempAppliedTypes = tempApplied.map( x => tempFilter.aggType );  // assume all child filters have the same type as their parent
          appliedFilters = appliedFilters.concat(tempApplied);
          appliedFilterAggTypes = appliedFilterAggTypes.concat(tempAppliedTypes);
      }
      return {
        appliedFilters,
        appliedFilterAggTypes,
      };
    }

    buildAndApplyTextFilters(aggregation_buckets, appliedFilters, appliedFilterAggTypes, aggType) {
      const { availableFilters, registry } = this.buildFilterTree(aggregation_buckets, appliedFilters);
      const orphans = this.applyFilters(registry, appliedFilters);
      return { availableFilters, registry, orphans };
    }

    buildAndApplySheetFilters(aggregation_buckets, appliedFilters, appliedFilterAggTypes, aggType) {
      const availableFilters = aggregation_buckets.map( b => {
        const isHeb = Sefaria.hebrew.isHebrew(b.key);
        const enTitle = isHeb ? '' : b.key;
        const heTitle = isHeb ? b.key : (aggType === 'group' || !Sefaria.terms[b.key] ? '' : Sefaria.terms[b.key].he);
        const aggKey = enTitle || heTitle;
        const filterInd = appliedFilters.indexOf(aggKey);
        const isSelected = filterInd !== -1 && appliedFilterAggTypes[filterInd] === aggType;
        return new FilterNode(
          {
            title: enTitle,
            heTitle,
            docCount: b.doc_count,
            aggKey,
            aggType,
            selected: isSelected ? 1 : 0
          }
        );
      });
      return { availableFilters, registry: {}, orphans: [] };
    }
}

module.exports = Search;
