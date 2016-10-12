var RUNWAY_ITEMS = 20;
var RUNWAY_ITEMS_OPPOSITE = 10;
var SCROLL_RUNWAY = 150;
var ANIMATION_DURATION_MS = 250;

angular.module('App')
  .directive('mdVirtualListContainer', VirtualListContainerDirective)
  .directive('mdVirtualList', VirtualListDirective);

function VirtualListContainerDirective() {
  return {
    restrict: 'AE',
    transclude: 'element',
    replace: true,
    template: '<div class="virtual-list-container"></div>',
    controller: VirtualListContainerController,
    compile: function VirtualListContainerCompile($element, $attrs) {
      return function Link($scope, $element, $attrs, ctrl, $transclude) {
          ctrl.link($transclude, $scope);
      }    
    }
  };
}

function VirtualListContainerController($scope, $element, $attrs, $document, $window) {
  this.virtualListController = null;  
  this.$scope = $scope;
  this.scroller_ = $element[0];

  this.anchorItem = { index: 0, offset: 0 };
  this.firstAttachedItem_ = 0;
  this.lastAttachedItem_ = 0;
  this.anchorScrollTop = 0;
  this.tombstoneSize_ = 54;
  this.tombstones_ = [];
  this.items_ = [];
  this.loadedItems_ = 0;
  
  this.scroller_.addEventListener('scroll', this.onScroll_.bind(this));
  $window.addEventListener('resize', this.onResize_.bind(this));

  this.scrollRunway_ = $document[0].createElement('div');
  // Internet explorer seems to require some text in this div in order to
  // ensure that it can be scrolled to.
  this.scrollRunway_.textContent = ' ';
  this.scrollRunwayEnd_ = 0;
  this.scrollRunway_.style.position = 'absolute';
  this.scrollRunway_.style.height = '1px';
  this.scrollRunway_.style.width = '1px';
  this.scrollRunway_.style.transition = 'transform 0.2s';

  this.scroller_.appendChild(this.scrollRunway_);
  //this.onResize_();
}

VirtualListContainerController.prototype.link = function($transclude) {
  this.transclude = $transclude;

  this.transclude(function(clone, scope) {
    var element = clone[0];

    this.tombstone = element.querySelector(".tombstone"); //store tombstone, but remove from template
    
    element.removeChild(this.tombstone);

    this.scroller_.appendChild(element);

    //this.onResize_(); 

  }.bind(this));
}

// var elm = angular.element(el);
// $compile(elm)($scope);
// document.body.appendChild(elm[0]);
// $scope.$digest();

VirtualListContainerController.prototype.onResize_ = function() {
    for (var i = 0; i < this.items_.length; i++) {
      this.items_[i].height = this.items_[i].width = 0;
    }

    this.onScroll_();
}

VirtualListContainerController.prototype.onScroll_ = function() {
    var delta = this.scroller_.scrollTop - this.anchorScrollTop;
    if (this.scroller_.scrollTop == 0) {
      this.anchorItem = { index: 0, offset: 0 };
    } else {
      this.anchorItem = this.calculateAnchoredItem(this.anchorItem, delta);
    }
    this.anchorScrollTop = this.scroller_.scrollTop;
    var lastScreenItem = this.calculateAnchoredItem(this.anchorItem, this.scroller_.offsetHeight);
    if (delta < 0)
      this.fill(this.anchorItem.index - RUNWAY_ITEMS, lastScreenItem.index + RUNWAY_ITEMS_OPPOSITE);
    else
      this.fill(this.anchorItem.index - RUNWAY_ITEMS_OPPOSITE, lastScreenItem.index + RUNWAY_ITEMS);
}

VirtualListContainerController.prototype.fill = function(start, end) {
  this.firstAttachedItem_ = Math.max(0, start);
  this.lastAttachedItem_ = end;
  this.attachContent();
}

VirtualListContainerController.prototype.attachContent = function() {
    // Collect nodes which will no longer be rendered for reuse.
    // TODO: Limit this based on the change in visible items rather than looping
    // over all items.
    var i;
    var unusedNodes = [];
    for (i = 0; i < this.items_.length; i++) {
      // Skip the items which should be visible.
      if (i == this.firstAttachedItem_) {
        i = this.lastAttachedItem_ - 1;
        continue;
      }
      if (this.items_[i].node) {
        if (this.items_[i].node.classList.contains('tombstone')) {
          this.tombstones_.push(this.items_[i].node);
          this.tombstones_[this.tombstones_.length - 1].classList.add('invisible');
        } else {
          unusedNodes.push(this.items_[i].node);
        }
      }
      this.items_[i].node = null;
    }

    var tombstoneAnimations = {};
    // Create DOM nodes.

    var promises = [];

    for (i = this.firstAttachedItem_; i < this.lastAttachedItem_; i++) {
      while (this.items_.length <= i)
        this.addItem_();
      if (this.items_[i].node) {
        // if it's a tombstone but we have data, replace it.
        if (this.items_[i].node.classList.contains('tombstone') && this.items_[i].data) {
          // TODO: Probably best to move items on top of tombstones and fade them in instead.
          if (ANIMATION_DURATION_MS) {
            this.items_[i].node.style.zIndex = 1;
            tombstoneAnimations[i] = [this.items_[i].node, this.items_[i].top - this.anchorScrollTop];
          } else {
            this.items_[i].node.classList.add('invisible');
            this.tombstones_.push(this.items_[i].node);
          }
          this.items_[i].node = null;
        } else {
          continue;
        }
      }
      var promise = this.items_[i].data ? this.render(this.items_[i].data, unusedNodes.pop()) : this.getTombstone();
      promises.push(promise.then(function(i, node) {
          // Maybe don't do this if it's already attached?
          node.style.position = 'absolute';
          this.items_[i].top = -1;
          this.scroller_.appendChild(node);
          this.items_[i].node = node;
        }.bind(this, i))
      );
    }

    return Promise.all(promises).then(function() {

      // Remove all unused nodes
      while (unusedNodes.length) {
        this.scroller_.removeChild(unusedNodes.pop());
      }

      // Get the height of all nodes which haven't been measured yet.
      for (i = this.firstAttachedItem_; i < this.lastAttachedItem_; i++) {
        // Only cache the height if we have the real contents, not a placeholder.
        if (this.items_[i].data && !this.items_[i].height) {
          this.items_[i].height = this.items_[i].node.offsetHeight;
          this.items_[i].width = this.items_[i].node.offsetWidth;
        }
      }

      // Fix scroll position in case we have realized the heights of elements
      // that we didn't used to know.
      // TODO: We should only need to do this when a height of an item becomes
      // known above.
      this.anchorScrollTop = 0;
      for (i = 0; i < this.anchorItem.index; i++) {
        this.anchorScrollTop += this.items_[i].height || this.tombstoneSize_;
      }
      this.anchorScrollTop += this.anchorItem.offset;

      // Position all nodes.
      var curPos = this.anchorScrollTop - this.anchorItem.offset;
      i = this.anchorItem.index;
      while (i > this.firstAttachedItem_) {
        curPos -= this.items_[i - 1].height || this.tombstoneSize_;
        i--;
      }
      while (i < this.firstAttachedItem_) {
        curPos += this.items_[i].height || this.tombstoneSize_;
        i++;
      }
      // Set up initial positions for animations.
      for (var i in tombstoneAnimations) {
        var anim = tombstoneAnimations[i];
        this.items_[i].node.style.transform = 'translateY(' + (this.anchorScrollTop + anim[1]) + 'px) scale(' + (this.tombstoneWidth_ / this.items_[i].width) + ', ' + (this.tombstoneSize_ / this.items_[i].height) + ')';
        // Call offsetTop on the nodes to be animated to force them to apply current transforms.
        this.items_[i].node.offsetTop;
        anim[0].offsetTop;
        this.items_[i].node.style.transition = 'transform ' + ANIMATION_DURATION_MS + 'ms';
      }
      for (i = this.firstAttachedItem_; i < this.lastAttachedItem_; i++) {
        var anim = tombstoneAnimations[i];
        if (anim) {
          anim[0].style.transition = 'transform ' + ANIMATION_DURATION_MS + 'ms, opacity ' + ANIMATION_DURATION_MS + 'ms';
          anim[0].style.transform = 'translateY(' + curPos + 'px) scale(' + (this.items_[i].width / this.tombstoneWidth_) + ', ' + (this.items_[i].height / this.tombstoneSize_) + ')';
          anim[0].style.opacity = 0;
        }
        if (curPos != this.items_[i].top) {
          if (!anim)
            this.items_[i].node.style.transition = '';
          this.items_[i].node.style.transform = 'translateY(' + curPos + 'px)';
        }
        this.items_[i].top = curPos;
        curPos += this.items_[i].height || this.tombstoneSize_;
      }

      this.scrollRunwayEnd_ = Math.max(this.scrollRunwayEnd_, curPos + SCROLL_RUNWAY)
      this.scrollRunway_.style.transform = 'translate(0, ' + this.scrollRunwayEnd_ + 'px)';
      this.scroller_.scrollTop = this.anchorScrollTop;

      if (ANIMATION_DURATION_MS) {
        // TODO: Should probably use transition end, but there are a lot of animations we could be listening to.
        setTimeout(function() {
          for (var i in tombstoneAnimations) {
            var anim = tombstoneAnimations[i];
            anim[0].classList.add('invisible');
            this.tombstones_.push(anim[0]);
            // Tombstone can be recycled now.
          }
        }.bind(this), ANIMATION_DURATION_MS)
      }

      this.maybeRequestContent();
    }.bind(this));
  },


/*--------------*/
VirtualListContainerController.prototype.calculateAnchoredItem = function(initialAnchor, delta) {
  if (delta == 0) return initialAnchor;
  if (!this.tombstoneSize_) 
  
  delta += initialAnchor.offset;
  var i = initialAnchor.index;

  var tombstones = 0;
  if (delta < 0) {
    while (delta < 0 && i > 0 && this.items_[i - 1].height) {
      delta += this.items_[i - 1].height;
      i--;
    }
    tombstones = Math.max(-i, Math.ceil(Math.min(delta, 0) / this.tombstoneSize_));
  } 
  else {
    while (delta > 0 && i < this.items_.length && this.items_[i].height && this.items_[i].height < delta) {
      delta -= this.items_[i].height;
      i++;
    }
    if (i >= this.items_.length || !this.items_[i].height)
      tombstones = Math.floor(Math.max(delta, 0) / this.tombstoneSize_);
  }
  i += tombstones;
  delta -= tombstones * this.tombstoneSize_;
  return {
    index: i,
    offset: delta,
  };
}

VirtualListContainerController.prototype.maybeRequestContent = function() {
  if (!this.virtualListController) return;
  if (this.requestInProgress_)
      return;
  var itemsNeeded = this.lastAttachedItem_ - this.loadedItems_;
  if (itemsNeeded <= 0)
    return;
  
  this.requestInProgress_ = true;

 
  Promise.resolve().then(function() {
    var items = [];
    for(var i = 0 ; i < itemsNeeded; i++) {
        items.push({
          value: i
        });
    }
    return items;
  }.bind(this)).then(this.addContent.bind(this));
}

VirtualListContainerController.prototype.register = function(virtualListController) {
  this.virtualListController = virtualListController;
}

VirtualListContainerController.prototype.addContent = function(items) {
  for (var i = 0; i < items.length; i++) {
    if (this.items_.length <= this.loadedItems_)
      this.addItem_();
    this.items_[this.loadedItems_++].data = items[i];
  }
  this.attachContent();
}

VirtualListContainerController.prototype.render = function(data, div) {
  return new Promise(function(resolve, reject) {
    // this.virtualListController.transclude(function(clone, scope) {
    //     scope["i"] = data;
    //     resolve(clone[0].children[0]);
    // });
  }.bind(this));
}

VirtualListContainerController.prototype.getTombstone = function() {
  return new Promise(function(resolve, reject) {
    var tombstone = this.tombstones_.pop();
    if (tombstone) {
      tombstone.classList.remove('invisible');
      tombstone.style.opacity = 1;
      tombstone.style.transform = '';
      tombstone.style.transition = '';
      resolve(tombstone);
    }
    resolve(this.tombstone.cloneNode(true));
  }.bind(this));
}

VirtualListContainerController.prototype.addItem_ = function() {
  this.items_.push({
    'data': null,
    'node': null,
    'height': 0,
    'width': 0,
    'top': 0,
  })
}

/*--------------*/

function VirtualListDirective($parse, $compile) {
  return {
    controller: VirtualListController,
    priority: 1000,
    require: ['mdVirtualList', '^^mdVirtualListContainer'],
    restrict: 'A',
    terminal: true,
    replace: true,
    transclude: 'element',
    compile: function VirtualListCompile($element, $attrs) {
      $element.addClass('md-virtual-list');

      var expression = $attrs.mdVirtualList;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)\s*$/);
      var repeatName = match[1];
      var repeatListExpression = $parse(match[2]);

      return function Link($scope, $element, $attrs, ctrl, $transclude) {
          ctrl[0].link(ctrl[1], $transclude, $compile, repeatName, repeatListExpression);
      }      
    }
  };
}

function VirtualListController($scope, $element, $attrs) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attrs = $attrs;
  
  this.repeatName = null;
  this.repeatListExpression = null;
  
  this.parentNode = $element[0].parentNode;
}

VirtualListController.prototype.link = function(container, $transclude, $compile, repeatName, repeatListExpression) {
  this.container = container;
  this.repeatName = repeatName;
  this.repeatListExpression = repeatListExpression;
  this.transclude = $transclude;
  this.$compile = $compile;
  this.container.register(this);
  this.container.onResize_(); 

  this.transclude(function(clone, scope) {
    var element = clone[0].children[0];

    this.$element[0].appendChild(element);

  }.bind(this));
}
