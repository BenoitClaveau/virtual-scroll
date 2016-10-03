var app = angular.module('App');

app.directive('mdRepeat', RepeatDirective);

function RepeatController($scope, $element, $attrs) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attrs = $attrs;
  
  this.repeatName = null;
  this.repeatListExpression = null;
  
  this.parentNode = $element[0].parentNode;
}

RepeatController.prototype.link = function($transclude, $timeout, repeatName, repeatListExpression) {
  this.repeatName = repeatName;
  this.repeatListExpression = repeatListExpression;
  this.transclude = $transclude;

  this.blocks = [];

  for(var i = 0 ; i < 5; i++) {
    this.transclude(angular.bind(this, function(clone, scope) {
      var block = {
        element: clone,
        new: true,
        scope: scope
      };
      
      //TODO bind model
      scope["i"] = { value: i };

      this.parentNode.appendChild(clone[0]);
      
      this.blocks.push(block);

    }));
  }

  $timeout(angular.bind(this, function() {
    var index = 0;
    this.parentNode.removeChild(this.blocks[index].element[0]);
    delete this.blocks[index];
  }), 2000);
};

function RepeatDirective($parse, $timeout) {
  return {
    controller: RepeatController,
    priority: 1000,
    restrict: 'A',
    terminal: true,
    replace: true,
    transclude: 'element',
    compile: function RepeatCompile($element, $attrs) {
      var expression = $attrs.mdRepeat;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)\s*$/);
      var repeatName = match[1];
      var repeatListExpression = $parse(match[2]);

      return function Link($scope, $element, $attrs, ctrl, $transclude) {
          ctrl.link($transclude, $timeout, repeatName, repeatListExpression);
      }      
    }
  };
}
