var app = angular.module('App', ['ngMaterial']);
  
app.controller('Controller', ['$scope', function() {
  this.dataset = {
    _items: [],
    getItemAtIndex: function(index) {
      if (index >= this._items.length ) {
        for (var i = 1; i <= 5; i++) {
          this._items.push({
            value: this._items.length + 1,
            h: Math.random() * (60 - 15) + 15 
          });
        }
      }
      return this._items[index];
    }, //getItemAtIndex
    getLength: function() {
      return this._items.length + 5;
    },
    /**/
    getItemAtIndex2: function(index) {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          resolve({
            index: index,
            data: {
              value: "INDEX " + index,
              h: Math.random() * (200 - 50) + 50
            } 
          });
        }.bind(this), Math.random() * 300);
      });
    }
  }; 
}]);
