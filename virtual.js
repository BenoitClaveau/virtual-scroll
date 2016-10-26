var RUNWAyITEMS = 10;
var RUNWAyITEMsOPPOSITE = 5;
var SCROLlRUNWAY = 200;
var ANIMATIOnDURATIOnMS = 1000;

angular.module('App')
  .directive('mdVirtualListContainer', ["$parse", "$rootScope", VirtualListContainerDirective]);

function VirtualListContainerDirective($parse, $rootScope) {
  return {
    restrict: 'AE',
    //transclude: 'element',
    //replace: true,
    //template: '<div></div>',
    controller: ["$scope", "$element", "$attrs", "$compile", "$rootScope", "$document", "$window", "$$rAF", "$mdUtil", VirtualListContainerController],
    compile: function VirtualListContainerCompile($element, $attrs) {

      var pullRequest = $element[0].querySelector(".pull-request");
      if (!pullRequest) throw new Error(".pull-request must be defined.");
      $element[0].removeChild(pullRequest);
      
      var tombstone = $element[0].querySelector(".tombstone");
      if (!tombstone) throw new Error(".tombstone must be defined.");
      $element[0].removeChild(tombstone);
      tombstone.classList.add('invisible');

      var template = $element[0].querySelector(".template");
      if (!template) throw new Error(".template must be defined.");
      $element[0].removeChild(template);

      $element.addClass("md-virtual-list-container");
      
      var expression = $attrs.mdVirtualListContainer;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)\s*$/);
      var repeatName = match[1];
      var repeatListExpression = $parse(match[2]);

      return function PostLink($scope, $element, $attrs, ctrl) {
        ctrl.link(repeatName, repeatListExpression, template, tombstone, pullRequest);
        ctrl.redraw();
      }
    }
  };
};

function VirtualListContainerController($scope, $element, $attrs, $compile, $rootScope, $document, $window, $$rAF, $mdUtil) {
  this.$scope = $scope;
  this.$compile = $compile;
  this.$rootScope = $rootScope;
  this.$$rAF = $$rAF;
  this.$mdUtil = $mdUtil;

  this.scroller = $element[0];

  this.anchorItem = { index: 0, offset: 0 };
  this.firstAttachedItem = 0;
  this.lastAttachedItem = 0;
  this.anchorScrollTop = 0;
  this.tombstoneSize = 0;
  this.tombstones = [];
  this.unused = [];
  this.items = [];
  this.loadedItems = 0;
  this.requestInProgress = false;

  this.pullRequestSize = 0;
  this.$scope.pullRefreshActivated = false;
  this.pullRequestTouchOrigin = -1;

  this.tombstone = null;
  this.template = null;
  this.pullRequest = null;

  this.scrollRunway = $document[0].createElement('div');
  this.scrollRunway.textContent = ' ';
  this.scrollRunwayEnd = 0;
  this.scrollRunway.style.position = 'absolute';
  this.scrollRunway.style.height = '1px';
  this.scrollRunway.style.width = '1px';
  this.scrollRunway.style.transition = 'transform 0.2s';

  this.scroller.appendChild(this.scrollRunway);

  var jWindow = angular.element($window);
  var jScroller = angular.element(this.scroller);

  var boundOnScroll = this.onScroll.bind(this);
  var boundOnResize = this.onResize.bind(this);
  var boundOnKeyDown = this.onKeyDown.bind(this);

  var boundOnTouchStart = this.onTouchStart.bind(this);
  var boundOnTouchMove = this.onTouchMove.bind(this);
  var boundOnTouchEnd = this.onTouchEnd.bind(this);
  var boundOnTouchLeave = this.onTouchLeave.bind(this);

  var debouncedOnResize = $mdUtil.debounce(boundOnResize, 5, null, false);
  var debouncedOnScroll = $mdUtil.debounce(boundOnScroll, 5, null, false);
  var debouncedOnKeyDown = $mdUtil.debounce(boundOnKeyDown, 5, null, false);

  var debouncedOnTouchMove = $mdUtil.debounce(boundOnTouchMove, 5, null, false);
  
  // this.$scope.$on("item", function(e, d) {
  //   if (d.index == 0) console.log("refresh done", d)
  // }.bind(this));

  jWindow.on('resize', debouncedOnResize);
  jWindow.on('keydown', debouncedOnKeyDown);
  jScroller.on('scroll', debouncedOnScroll);
  jWindow.on('touchstart', boundOnTouchStart);

  jWindow.on('touchmove', debouncedOnTouchMove);
  jWindow.on('touchend', boundOnTouchEnd);
  jWindow.on('touchleave', boundOnTouchLeave);

  $scope.$on('$destroy', function() {
    jWindow.off('resize', debouncedOnResize);
    jWindow.off('keydown', debouncedOnKeyDown);
    jScroller.off('scroll', debouncedOnScroll);
    jWindow.off('touchstart', boundOnTouchStart);
    jWindow.off('touchmove', debouncedOnTouchMove);
    jWindow.off('touchend', boundOnTouchEnd);
    jWindow.off('touchleave', boundOnTouchLeave);
  });
}

VirtualListContainerController.prototype.link = function(repeatName, repeatListExpression, template, tombstone, pullRequest) {
  this.repeatName = repeatName;
  this.rawRepeatListExpression = repeatListExpression;
  this.template = template;
  this.tombstone = tombstone;

  //var template = this.template.cloneNode(true);
  var compiled = this.$compile(pullRequest)(this.$scope);
  //this.$scope.$apply();

  this.pullRequest = compiled[0];
  this.pullRequest.style.position = 'absolute';
  this.pullRequest.style.transition = 'transform 0.2s';
  this.pullRequest.style.transform = 'translateY(-100px)' //default value
  this.scroller.appendChild(this.pullRequest);
}

VirtualListContainerController.prototype.onResize = function() {

    if(!this.scroller.offsetHeight) {
      setTimeout(function() {
        this.onResize();
      }.bind(this), 10);
      return;
    }

    this.pullRequestSize = this.pullRequest.offsetHeight;
    this.pullRequest.style.transform = 'translateY(' + (-this.pullRequestSize) + 'px)';
    
    var tombstone = this.tombstone.cloneNode(true);
    tombstone.style.position = 'absolute';
    this.scroller.appendChild(tombstone);
    tombstone.classList.remove('invisible');
    this.tombstoneSize = tombstone.offsetHeight;
    this.scroller.removeChild(tombstone);

    for (var i = 0; i < this.items.length; i++) {
      this.items[i].height = this.items[i].width = 0;
    }

    this.onScroll();
}

VirtualListContainerController.prototype.onKeyDown = function(event) {
  if (event.keyCode == 38 || event.keyCode == 40 || event.keyCode == 33 || event.keyCode == 34) { 
      event.preventDefault();
      event.stopPropagation();
      var coef = event.keyCode > 34 ? 0.90 : 0.10;
      offset = this.scroller.offsetHeight * coef; 
      if (event.keyCode == 33 || event.keyCode == 38) offset = offset * -1;
      this.scroller.scrollTop = this.scroller.scrollTop + offset;
      this.onScroll();
    }
}

VirtualListContainerController.prototype.onTouchStart = function(event) {
  var rect = this.scroller.getBoundingClientRect();
  var pan = event.changedTouches[0].clientY - rect.top;

  if (pan < 40) {
    event.preventDefault();
    event.stopPropagation();
    this.pullRequest.style.transition = 'none';
    this.pullRequestTouchOrigin = event.changedTouches[0].clientY;
  }
  else {
    this.pullRequestTouchOrigin = -1;
  }
}

VirtualListContainerController.prototype.onTouchMove = function(event) {  
  if (this.pullRequestTouchOrigin == -1) return;
  var offset = event.changedTouches[0].clientY - this.pullRequestTouchOrigin;
  
  if (offset > 0) {
    this.pullRequest.style.transform = 'translateY(' + this.scroller.scrollTop + 'px)';
    this.pullRequest.style.height =  offset + this.pullRequestSize + 'px';
  }
  else
    this.pullRequest.style.transform = 'translateY(' + this.scroller.scrollTop + (offset - this.pullRequestSize) + 'px)';

  this.$scope.$apply(function() {
    this.$scope.pullRefreshActivated = offset > this.pullRequestSize;
  }.bind(this));
  

  return false
}

VirtualListContainerController.prototype.onTouchEnd = function() {
  if (this.pullRequestTouchOrigin == -1) return;

  this.pullRequestTouchOrigin = -1;
  this.pullRequest.style.transition = 'transform' + ANIMATIOnDURATIOnMS + 'ms';
  if (this.$scope.pullRefreshActivated) {
    this.$scope.pullRefreshActivated = false;
    this.pullRequest.style.transform = 'translateY(' + (-this.pullRequestSize) + 'px)';
    this.pullRequest.style.height = this.pullRequestSize + 'px';
    this.refresh();
  }
  else {
    this.$scope.pullRefreshActivated = false;
    this.pullRequest.style.transform = 'translateY(' + (-this.pullRequestSize) + 'px)';
    this.pullRequest.style.height = this.pullRequestSize + 'px';
  }
}

VirtualListContainerController.prototype.onTouchLeave = function() {
  if (this.pullRequestTouchOrigin == -1) return;

  this.pullRequestTouchOrigin = -1;
  this.$scope.pullRefreshActivated = false;
  this.pullRequest.style.transition = 'transform' + ANIMATIOnDURATIOnMS + 'ms';
  this.pullRequest.style.transform = 'translateY(' + (-this.pullRequestSize) + 'px)';
  this.pullRequest.style.height = this.pullRequestSize + 'px';
}

VirtualListContainerController.prototype.refresh = function() {

  while (this.items.length) {
    var item = this.items.pop();
    if (item.node) this.unused.push(item.node);
  }

  this.anchorItem = { index: 0, offset: 0 };
  this.firstAttachedItem = 0;
  this.lastAttachedItem = 0;
  this.anchorScrollTop = 0;
  this.loadedItems = 0;
  this.scroller.scrollTop = 0;

  this.onScroll();  
}

VirtualListContainerController.prototype.onScroll = function() {
    if (this.pullRequestTouchOrigin !== -1) return true; 
    
    var delta = this.scroller.scrollTop - this.anchorScrollTop;

    if (this.scroller.scrollTop == 0) {
      this.anchorItem = { index: 0, offset: 0 };
    } else {
      this.anchorItem = this.calculateAnchoredItem(this.anchorItem, delta);
    }
    this.anchorScrollTop = this.scroller.scrollTop;
    var lastScreenItem = this.calculateAnchoredItem(this.anchorItem, this.scroller.offsetHeight);
    if (delta < 0) {
      this.fill(this.anchorItem.index - RUNWAyITEMS, lastScreenItem.index + RUNWAyITEMsOPPOSITE);
    }
    else {
      this.fill(this.anchorItem.index - RUNWAyITEMsOPPOSITE, lastScreenItem.index + RUNWAyITEMS);
    }
}

VirtualListContainerController.prototype.fill = function(start, end) {
  this.firstAttachedItem = Math.max(start, 0);
  this.lastAttachedItem = end;
  this.attachContent();
}

VirtualListContainerController.prototype.attachContent = function() {
    var i;
    for (i = 0; i < this.items.length; i++) {
      //Skip the items which should be visible.
      if (i == this.firstAttachedItem) {
        i = this.lastAttachedItem - 1;
        continue;
      }
      if (this.items[i].node) {
        if (this.items[i].node.classList.contains('tombstone')) {
          this.tombstones.push(this.items[i].node);
          this.tombstones[this.tombstones.length - 1].classList.add('invisible');
        } else {
          this.unused.push(this.items[i].node);
        }
      }
      this.items[i].node = null;
    }

    var tombstoneAnimations = {};
    // Create DOM nodes.

    var promises = [];

    for (i = this.firstAttachedItem; i < this.lastAttachedItem; i++) {
      while (this.items.length <= i)
        this.addItem();

      if (this.items[i].node) {
        // if it's a tombstone but we have data, replace it.
        if (this.items[i].node.classList.contains('tombstone') && this.items[i].data) {
          // TODO: Probably best to move items on top of tombstones and fade them in instead.
          if (ANIMATIOnDURATIOnMS) {
            this.items[i].node.style.zIndex = 1;
            tombstoneAnimations[i] = [this.items[i].node, this.items[i].top - this.anchorScrollTop];
          } else {
            this.items[i].node.classList.add('invisible');
            this.tombstones.push(this.items[i].node);
          }
          this.items[i].node = null;
        } else {
          continue; //node already exists
        }
      }

      var node = this.items[i].data ? this.render(this.items[i].data, i) : this.getTombstone();
      node.style.position = 'absolute';
      this.items[i].top = -1;
      this.scroller.appendChild(node);
      this.items[i].node = node;
    }
    
    // Remove all unused nodes
    while (this.unused.length) {
      this.scroller.removeChild(this.unused.pop());
    }

    // Get the height of all nodes which haven't been measured yet.
    for (i = this.firstAttachedItem; i < this.lastAttachedItem; i++) {
      // Only cache the height if we have the real contents, not a placeholder.
      if (this.items[i].data && !this.items[i].height) {
        this.items[i].height = this.items[i].node.offsetHeight;
        this.items[i].width = this.items[i].node.offsetWidth;
        
        //BC
        if (!this.items[i].height) this.redraw();
      }
    }

    // Fix scroll position in case we have realized the heights of elements
    // that we didn't used to know.
    // TODO: We should only need to do this when a height of an item becomes
    // known above.
    this.anchorScrollTop = 0;
    for (i = 0; i < this.anchorItem.index; i++) {
      this.anchorScrollTop += this.items[i].height || this.tombstoneSize;
    }
    this.anchorScrollTop += this.anchorItem.offset;

    // Position all nodes.
    var curPos = this.anchorScrollTop - this.anchorItem.offset;
    i = this.anchorItem.index;
    while (i > this.firstAttachedItem) {
      curPos -= this.items[i - 1].height || this.tombstoneSize;
      i--;
    }
    while (i < this.firstAttachedItem) {
      curPos += this.items[i].height || this.tombstoneSize;
      i++;
    }
    // Set up initial positions for animations.
    for (var i in tombstoneAnimations) {
      var anim = tombstoneAnimations[i];
      this.items[i].node.style.transform = 'translateY(' + (this.anchorScrollTop + anim[1]) + 'px) scale(' + (this.tombstoneWidth_ / this.items[i].width) + ', ' + (this.tombstoneSize / this.items[i].height) + ')';
      
      // Call offsetTop on the nodes to be animated to force them to apply current transforms.
      this.items[i].node.offsetTop;
      anim[0].offsetTop;
      this.items[i].node.style.transition = 'transform ' + ANIMATIOnDURATIOnMS + 'ms';
    }
    for (i = this.firstAttachedItem; i < this.lastAttachedItem; i++) {
      var anim = tombstoneAnimations[i];
      if (anim) {
        anim[0].style.transition = 'transform ' + ANIMATIOnDURATIOnMS + 'ms, opacity ' + ANIMATIOnDURATIOnMS + 'ms';
        anim[0].style.transform = 'translateY(' + curPos + 'px) scale(' + (this.items[i].width / this.tombstoneWidth_) + ', ' + (this.items[i].height / this.tombstoneSize) + ')';
        anim[0].style.opacity = 0;
      }
      if (curPos != this.items[i].top) {
        if (!anim) this.items[i].node.style.transition = '';
        this.items[i].node.style.transform = 'translateY(' + curPos + 'px)';
      }
      this.items[i].top = curPos;
      curPos += this.items[i].height || this.tombstoneSize;
    }

    this.scrollRunwayEnd = Math.max(this.scrollRunwayEnd, curPos + SCROLlRUNWAY)
    this.scrollRunway.style.transform = 'translate(0, ' + this.scrollRunwayEnd + 'px)';
    this.scroller.scrollTop = this.anchorScrollTop;

    if (ANIMATIOnDURATIOnMS) {
      // TODO: Should probably use transition end, but there are a lot of animations we could be listening to.
      setTimeout(function() {
        for (var i in tombstoneAnimations) {
          var anim = tombstoneAnimations[i];
          anim[0].classList.add('invisible');
          this.tombstones.push(anim[0]);
          // Tombstone can be recycled now.
        }
      }.bind(this), ANIMATIOnDURATIOnMS)
    }

    this.maybeRequestContent();
  }


/*--------------*/
VirtualListContainerController.prototype.calculateAnchoredItem = function(initialAnchor, delta) {
  if (delta == 0) return initialAnchor;
  
  delta += initialAnchor.offset;
  var i = initialAnchor.index;

  var tombstones = 0;
  if (delta < 0) {
    while (delta < 0 && i > 0 && this.items[i - 1].height) {
      delta += this.items[i - 1].height;
      i--;
    }
    tombstones = Math.max(-i, Math.ceil(Math.min(delta, 0) / this.tombstoneSize));
  } 
  else {
    while (delta > 0 && i < this.items.length && this.items[i].height && this.items[i].height < delta) {
      delta -= this.items[i].height;
      i++;
    }
    if (i >= this.items.length || !this.items[i].height)
      tombstones = Math.floor(Math.max(delta, 0) / this.tombstoneSize);
  }
  i += tombstones;
  delta -= tombstones * this.tombstoneSize;
  return {
    index: i,
    offset: delta,
  };
}

VirtualListContainerController.prototype.addItem = function() {
  this.items.push({
    'data': null,
    'node': null,
    'height': 0,
    'width': 0,
    'top': 0,
  });
}

VirtualListContainerController.prototype.redraw = function() {
  this.$$rAF(function() {
    var evt = document.createEvent('UIEvents');
    evt.initUIEvent('resize', true, false, window, 0);
    window.dispatchEvent(evt);
  }.bind(this));
}

VirtualListContainerController.prototype.getTombstone = function() {
  var tombstone = this.tombstones.pop();
  if (!tombstone) return this.tombstone.cloneNode(true);

  tombstone.classList.remove('invisible');
  tombstone.style.opacity = 1;
  tombstone.style.transform = '';
  tombstone.style.transition = '';
  return tombstone;
}

VirtualListContainerController.prototype.render = function(data, index) {
  // var div = this.unused.pop();
  // if (div) {
  //   console.log("recycle")
  // }

  var scope = this.$rootScope.$new(true);

  scope.$index = index;
  scope[this.repeatName] = data;

  var template = this.template.cloneNode(true);
  var compiled = this.$compile(template)(scope);
  scope.$apply();

  //console.log("render index", index, data, compiled[0])
  //this.$scope.$emit("item", {index: index, data: data});
  return compiled[0];
}

VirtualListContainerController.prototype.maybeRequestContent = function() {
  if (this.requestInProgress) return;
  
  var take = this.lastAttachedItem - this.loadedItems;
  if (take <= 0) return;
  
  this.requestInProgress = true;
  
  var repeatList = this.rawRepeatListExpression(this.$scope);

  repeatList.fetch(this.loadedItems, take).then(function(res) {
    res.map(function(item) {
      while (this.items.length <= this.loadedItems)
        this.addItem();
      this.items[this.loadedItems++].data = item;
    }.bind(this));
    this.requestInProgress = false;
    this.attachContent();
  }.bind(this));
}
