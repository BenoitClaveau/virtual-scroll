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
    }
  }; 

}]);
