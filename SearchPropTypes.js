const FilterNode = require('./FilterNode');

const SearchPropTypes = {
  filterNode: function(props, propName, componentName) {
    if (typeof props[propName] == 'undefined' || props[propName] === null) {
      return new Error(`${props[propName]} cannot be null or undefined`);
    }
    if (!(props[propName] instanceof FilterNode)) {
      return new Error(`${props[propName]} is of type ${typeof props[propName]} instead of 'FilterNode'`)
    }
  }
};

module.exports = SearchPropTypes;
