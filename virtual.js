var RUNWAyITEMS = 2;
var RUNWAyITEMsOPPOSITE = 2;
var SCROLlRUNWAY = 200;
var ANIMATIOnDURATIOnMS = 250;

angular.module('App')
  .directive('mdVirtualListContainer', VirtualListContainerDirective);

function VirtualListContainerDirective($parse, $compile, $rootScope, $window) {
  return {
    restrict: 'AE',
    transclude: 'element',
    replace: true,
    template: '<div class="virtual-list-container"></div>',
    controller: VirtualListContainerController,
    compile: function VirtualListContainerCompile($element, $attrs) {
      $element.addClass("md-virtual-list-container");

      var expression = $attrs.mdVirtualListContainer;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)\s*$/);
      var repeatName = match[1];
      var repeatListExpression = $parse(match[2]);

      return function Link($scope, $element, $attrs, ctrl, $transclude) {
          ctrl.link($transclude, $compile, repeatName, repeatListExpression, $rootScope);
      }    
    }
  };
}

function VirtualListContainerController($scope, $element, $attrs, $document, $window, $$rAF, $mdUtil) {

  this.$scope = $scope;
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

  this.tombstone = null;
  this.templateStr = null;

  this.scrollRunway = $document[0].createElement('div');
  this.scrollRunway.textContent = ' ';
  this.scrollRunwayEnd = 0;
  this.scrollRunway.style.position = 'absolute';
  this.scrollRunway.style.height = '1px';
  this.scrollRunway.style.width = '1px';
  this.scrollRunway.style.transition = 'transform 0.2s';

  this.scroller.appendChild(this.scrollRunway);

  this.$$rAF = $$rAF;
  this.$mdUtil = $mdUtil;

  var jWindow = angular.element($window);
  var jScroller = angular.element(this.scroller);

  var boundOnScroll = this.onScroll.bind(this);
  var boundOnResize = this.onResize.bind(this);
  var boundOnKeyDown = this.onKeyDown.bind(this);

  var debouncedOnResize = $mdUtil.debounce(boundOnResize, 10, null, false);
  var debouncedOnScroll = $mdUtil.debounce(boundOnScroll, 10, null, false);

  jWindow.on('resize', debouncedOnResize);
  jWindow.on('keydown', boundOnKeyDown);
  jScroller.on('scroll', debouncedOnScroll);

  $scope.$on('$destroy', function() {
    jWindow.off('resize', debouncedOnResize);
    jWindow.off('keydown', boundOnKeyDown);
    jScroller.off('scroll', debouncedOnScroll);
  });
}

VirtualListContainerController.prototype.link = function($transclude, $compile, repeatName, repeatListExpression, $rootScope) {
  this.repeatName = repeatName;
  this.rawRepeatListExpression = repeatListExpression;
  this.transclude = $transclude;
  this.$compile = $compile;
  this.$rootScope = $rootScope;

  this.transclude(function(clone, scope) {
    var element = clone[0];

    this.tombstone = element.querySelector(".tombstone"); //store tombstone, but remove from template
    if (!this.tombstone) throw new Error(".tombstone must be defined.");
    
    this.templateStr = element.querySelector(".template").outerHTML.trim(); //store tombstone, but remove from template
    if (!this.templateStr) throw new Error(".template must be defined.");

    this.$mdUtil.nextTick(function() {
      this.onResize();
    }.bind(this));
  }.bind(this));
}

// var elm = angular.element(el);
// $compile(elm)($scope);
// document.body.appendChild(elm[0]);
// $scope.$digest();

VirtualListContainerController.prototype.onResize = function() {

    this.scroller.style.height = window.innerHeight - 40 + "px";

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
  if (event.keyCode == 16 || event.keyCode == 17) { 

      var offset = this.scroller.offsetHeight * 0.75;
      if (event.keyCode == 17 ) offset * -1;

      this.scroller.scrollTop = this.scroller.scrollTop + offset;

      this.onScroll();
      event.preventDefault();
      event.stopPropagation();
    }
}

VirtualListContainerController.prototype.onScroll = function() {
    var delta = this.scroller.scrollTop - this.anchorScrollTop;

    //console.log("delta", delta, this.scroller.scrollTop, this.anchorScrollTop)

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
    // Collect nodes which will no longer be rendered for reuse.
    // TODO: Limit this based on the change in visible items rather than looping
    // over all items.
    console.log("----------", this.scroller.children.length)
    console.log("items.length", this.items.length, "firstAttachedItem", this.firstAttachedItem, "lastAttachedItem", this.lastAttachedItem)
    
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
          //this.scroller.removeChild(this.items[i].node);
        }
      }
      this.items[i].node = null;
    }

    //if (this.unused.length) console.log("unused", this.unused.length);

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
      console.log("append node", i)
      
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
        if (!anim)
          this.items[i].node.style.transition = '';
        this.items[i].node.style.transform = 'translateY(' + curPos + 'px)';
      }
      this.items[i].top = curPos;
      curPos += this.items[i].height || this.tombstoneSize;
    }

    this.scrollRunwayEnd = Math.max(this.scrollRunwayEnd, curPos + SCROLlRUNWAY)
    this.scrollRunway.style.transform = 'translate(0, ' + this.scrollRunwayEnd + 'px)';
    this.scroller.scrollTop = this.anchorScrollTop;

    console.log("this.scrollRunwayEnd", this.scrollRunwayEnd);

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

  console.log("add empty item", this.items.length - 1)
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

  var compiled = this.$compile(this.templateStr)(scope);
  scope.$apply();
  return compiled[0];
}

VirtualListContainerController.prototype.maybeRequestContent = function() {
  if (this.requestInProgress) return;
  
  var itemsNeeded = this.lastAttachedItem - this.loadedItems;
  if (itemsNeeded <= 0) return;
  
  this.requestInProgress = true;
  
  var repeatList = this.rawRepeatListExpression(this.$scope);
  var promises = [];

  for(var i = this.loadedItems ; i < this.lastAttachedItem; i++) {

    var promise = repeatList.getItemAtIndex2(i).then(function(res) {
      if (this.items.length <= this.loadedItems)
        this.addItem();
      
      this.loadedItems++;
      this.items[res.index].data = res.data;
    }.bind(this));

    promises.push(promise);
  }

  return Promise.all(promises).then(function() {
    this.attachContent();
    this.requestInProgress = false;
  }.bind(this));
}
