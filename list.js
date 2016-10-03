angular.module('App')
.directive('mdVirtualListContainer', VirtualListContainerDirective)
.directive('mdVirtualList', VirtualListDirective);

function VirtualListContainerDirective() {
  return {
    controller: VirtualListContainerController,
    template: virtualListContainerTemplate,
    compile: function virtualListContainerCompile($element, $attrs) {
      $element
          .addClass('md-virtual-repeat-container');
    }
  };
}


function virtualListContainerTemplate($element) {
  return '<div class="md-virtual-repeat-scroller">' +
    '<div class="md-virtual-repeat-sizer"></div>' +
    '<div class="md-virtual-repeat-offsetter">' +
      $element[0].innerHTML +
    '</div></div>';
}

/**
 * Number of additional elements to render above and below the visible area inside
 * of the virtual repeat container. A higher number results in less flicker when scrolling
 * very quickly in Safari, but comes with a higher rendering and dirty-checking cost.
 * @const {number}
 */
var NUM_EXTRA = 3;

/** @ngInject */
function VirtualListContainerController($$rAF, $mdUtil, $mdConstant, $parse, $rootScope, $window, $scope,
                                          $element, $attrs) {
  this.$rootScope = $rootScope;
  this.$scope = $scope;
  this.$element = $element;
  this.$attrs = $attrs;

  /** @type {number} The width or height of the container */
  this.size = 0;
  /** @type {number} The scroll width or height of the scroller */
  this.scrollSize = 0;
  /** @type {number} The scrollLeft or scrollTop of the scroller */
  this.scrollOffset = 0;
  /** @type {!VirtualListController} The repeater inside of this container */
  this.repeater = null;
  /** @type {?number} Original container size when shrank */
  this.originalSize = null;
  /** @type {number} Amount to offset the total scroll size by. */
  this.offsetSize = parseInt(this.$attrs.mdOffsetSize, 10) || 0;
  /** @type {?string} height or width element style on the container prior to auto-shrinking. */
  this.oldElementSize = null;
  /** @type {!number} Maximum amount of pixels allowed for a single DOM element */
  this.maxElementPixels = $mdConstant.ELEMENT_MAX_PIXELS;

  this.scroller = $element[0].querySelector('.md-virtual-repeat-scroller');
  this.sizer = this.scroller.querySelector('.md-virtual-repeat-sizer');
  this.offsetter = this.scroller.querySelector('.md-virtual-repeat-offsetter');

  // After the dom stablizes, measure the initial size of the container and
  // make a best effort at re-measuring as it changes.
  var boundUpdateSize = angular.bind(this, this.updateSize);

  $$rAF(angular.bind(this, function() {
    boundUpdateSize();

    var debouncedUpdateSize = $mdUtil.debounce(boundUpdateSize, 10, null, false);
    var jWindow = angular.element($window);

    // Make one more attempt to get the size if it is 0.
    // This is not by any means a perfect approach, but there's really no
    // silver bullet here.
    if (!this.size) {
      debouncedUpdateSize();
    }

    jWindow.on('resize', debouncedUpdateSize);
    $scope.$on('$destroy', function() {
      jWindow.off('resize', debouncedUpdateSize);
    });

    $scope.$emit('$md-resize-enable');
    $scope.$on('$md-resize', boundUpdateSize);
  }));
}


/** Called by the md-virtual-repeat inside of the container at startup. */
VirtualListContainerController.prototype.register = function(repeaterCtrl) {
  this.repeater = repeaterCtrl;

  angular.element(this.scroller)
      .on('scroll wheel touchmove touchend', angular.bind(this, this.handleScroll_));
};

/** @return {number} The size (width or height) of the container. */
VirtualListContainerController.prototype.getSize = function() {
  return this.size;
};


/**
 * Resizes the container.
 * @private
 * @param {number} size The new size to set.
 */
VirtualListContainerController.prototype.setSize_ = function(size) {
  var dimension = this.getDimensionName_();

  this.size = size;
  this.$element[0].style[dimension] = size + 'px';
};


VirtualListContainerController.prototype.unsetSize_ = function() {
  this.$element[0].style[this.getDimensionName_()] = this.oldElementSize;
  this.oldElementSize = null;
};


/** Instructs the container to re-measure its size. */
VirtualListContainerController.prototype.updateSize = function() {
  // If the original size is already determined, we can skip the update.
  if (this.originalSize) return;

  this.size = this.$element[0].clientHeight;

  // Recheck the scroll position after updating the size. This resolves
  // problems that can result if the scroll position was measured while the
  // element was display: none or detached from the document.
  this.handleScroll_();

  this.repeater && this.repeater.containerUpdated();
};


/** @return {number} The container's scrollHeight or scrollWidth. */
VirtualListContainerController.prototype.getScrollSize = function() {
  return this.scrollSize;
};


VirtualListContainerController.prototype.getDimensionName_ = function() {
  return 'height';
};


/**
 * Sets the scroller element to the specified size.
 * @private
 * @param {number} size The new size.
 */
VirtualListContainerController.prototype.sizeScroller_ = function(size) {
  var dimension =  this.getDimensionName_();
  var crossDimension = 'width';

  // Clear any existing dimensions.
  this.sizer.innerHTML = '';

  // If the size falls within the browser's maximum explicit size for a single element, we can
  // set the size and be done. Otherwise, we have to create children that add up the the desired
  // size.
  if (size < this.maxElementPixels) {
    this.sizer.style[dimension] = size + 'px';
  } else {
    this.sizer.style[dimension] = 'auto';
    this.sizer.style[crossDimension] = 'auto';

    // Divide the total size we have to render into N max-size pieces.
    var numChildren = Math.floor(size / this.maxElementPixels);

    // Element template to clone for each max-size piece.
    var sizerChild = document.createElement('div');
    sizerChild.style[dimension] = this.maxElementPixels + 'px';
    sizerChild.style[crossDimension] = '1px';

    for (var i = 0; i < numChildren; i++) {
      this.sizer.appendChild(sizerChild.cloneNode(false));
    }

    // Re-use the element template for the remainder.
    sizerChild.style[dimension] = (size - (numChildren * this.maxElementPixels)) + 'px';
    this.sizer.appendChild(sizerChild);
  }
};

/**
 * Sets the scrollHeight or scrollWidth. Called by the repeater based on
 * its item count and item size.
 * @param {number} itemsSize The total size of the items.
 */
VirtualListContainerController.prototype.setScrollSize = function(itemsSize) {
  var size = itemsSize + this.offsetSize;
  if (this.scrollSize === size) return;

  this.sizeScroller_(size);
  this.scrollSize = size;
};


/** @return {number} The container's current scroll offset. */
VirtualListContainerController.prototype.getScrollOffset = function() {
  return this.scrollOffset;
};

/**
 * Scrolls to a given scrollTop position.
 * @param {number} position
 */
VirtualListContainerController.prototype.scrollTo = function(position) {
  this.scroller['scrollTop'] = position;
  this.handleScroll_();
};

/**
 * Scrolls the item with the given index to the top of the scroll container.
 * @param {number} index
 */
VirtualListContainerController.prototype.scrollToIndex = function(index) {
  var itemSize = this.repeater.getItemSize();
  var itemsLength = this.repeater.itemsLength;
  if(index > itemsLength) {
    index = itemsLength - 1;
  }
  this.scrollTo(itemSize * index);
};

VirtualListContainerController.prototype.resetScroll = function() {
  this.scrollTo(0);
};


VirtualListContainerController.prototype.handleScroll_ = function() {
  var doc = angular.element(document)[0];

  var offset = this.scroller.scrollTop;
  if (offset === this.scrollOffset || offset > this.scrollSize - this.size) return;

  var itemSize = this.repeater.getItemSize();
  if (!itemSize) return;

  var numItems = Math.max(0, Math.floor(offset / itemSize) - NUM_EXTRA);

  var transform = 'translateY(' + (numItems * itemSize)  + 'px)';

  this.scrollOffset = offset;
  this.offsetter.style.webkitTransform = transform;
  this.offsetter.style.transform = transform;

  this.repeater.containerUpdated();
};

function VirtualListDirective($parse) {
  return {
    controller: VirtualListController,
    priority: 1000,
    require: ['mdVirtualList', '^^mdVirtualListContainer'],
    restrict: 'A',
    terminal: true,
    transclude: 'element',
    compile: function VirtualListCompile($element, $attrs) {
      var expression = $attrs.mdVirtualList;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)\s*$/);
      var repeatName = match[1];
      var repeatListExpression = $parse(match[2]);

      return function VirtualListLink($scope, $element, $attrs, ctrl, $transclude) {
        ctrl[0].link_(ctrl[1], $transclude, repeatName, repeatListExpression);
      };
    }
  };
}


/** @ngInject */
function VirtualListController($scope, $element, $attrs, $browser, $document, $rootScope,
    $$rAF, $mdUtil) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attrs = $attrs;
  this.$browser = $browser;
  this.$document = $document;
  this.$rootScope = $rootScope;
  this.$$rAF = $$rAF;

  /** @type {!Function} Backup reference to $browser.$$checkUrlChange */
  this.browserCheckUrlChange = $browser.$$checkUrlChange;
  /** @type {number} Most recent starting repeat index (based on scroll offset) */
  this.newStartIndex = 0;
  /** @type {number} Most recent ending repeat index (based on scroll offset) */
  this.newEndIndex = 0;
  /** @type {number} Most recent end visible index (based on scroll offset) */
  this.newVisibleEnd = 0;
  /** @type {number} Previous starting repeat index (based on scroll offset) */
  this.startIndex = 0;
  /** @type {number} Previous ending repeat index (based on scroll offset) */
  this.endIndex = 0;
  // TODO: measure width/height of first element from dom if not provided.
  // getComputedStyle?
  /** @type {?number} Height/width of repeated elements. */
  this.itemSize = null;
  /**
   * @private {boolean} Whether the items in the list are already being updated. Used to prevent
   *     nested calls to virtualListUpdate_.
   */
  this.isVirtualListUpdating_ = false;

  /** @type {number} Most recently seen length of items. */
  this.itemsLength = 0;

  /**
   * @type {!Function} Unwatch callback for item size (when md-items-size is
   *     not specified), or angular.noop otherwise.
   */
  this.unwatchItemSize_ = angular.noop;

  /**
   * Presently rendered blocks by repeat index.
   * @type {Object<number, !VirtualListController.Block}
   */
  this.blocks = {};
  /** @type {Array<!VirtualListController.Block>} A pool of presently unused blocks. */
  this.pooledBlocks = [];

  $scope.$on('$destroy', angular.bind(this, this.cleanupBlocks_));
}


/**
 * An object representing a repeated item.
 * @typedef {{element: !jqLite, new: boolean, scope: !angular.Scope}}
 */
VirtualListController.Block;


VirtualListController.prototype.link_ =
    function(container, transclude, repeatName, repeatListExpression) {
  this.container = container;
  this.transclude = transclude;
  this.repeatName = repeatName;
  this.rawListListExpression = repeatListExpression;
  this.sized = false;

  this.repeatListExpression = angular.bind(this, this.repeatListExpression_);

  this.container.register(this);
};


/** @private Cleans up unused blocks. */
VirtualListController.prototype.cleanupBlocks_ = function() {
  angular.forEach(this.pooledBlocks, function cleanupBlock(block) {
    block.element.remove();
  });
};


/** @private Attempts to set itemSize by measuring a repeated element in the dom */
VirtualListController.prototype.readItemSize_ = function() {
  if (this.itemSize) {
    // itemSize was successfully read in a different asynchronous call.
    return;
  }

  this.items = this.repeatListExpression(this.$scope);
  this.parentNode = this.$element[0].parentNode; //== md-virtual-repeat-offsetter
  var block = this.getBlock_(0);
  if (!block.element[0].parentNode) {
    this.parentNode.appendChild(block.element[0]);
  }

  this.itemSize = block.element[0]['offsetHeight'] || null;
  var computedStyle = window.getComputedStyle(block.element[0]);
  var bounding = block.element[0].getBoundingClientRect();

  this.blocks[0] = block;
  this.poolBlock_(0);

  if (this.itemSize) {
    this.containerUpdated();
  }
};


/**
 * Returns the user-specified repeat list, transforming it into an array-like
 * object in the case of infinite scroll/dynamic load mode.
 * @param {!angular.Scope} The scope.
 * @return {!Array|!Object} An array or array-like object for iteration.
 */
VirtualListController.prototype.repeatListExpression_ = function(scope) {
  var repeatList = this.rawListListExpression(scope);

  var virtualList = new VirtualListModelArrayLike(repeatList);
  virtualList.$$includeIndexes(this.newStartIndex, this.newVisibleEnd);
  return virtualList;
  
};


/**
 * Called by the container. Informs us that the containers scroll or size has
 * changed.
 */
VirtualListController.prototype.containerUpdated = function() {
  // If itemSize is unknown, attempt to measure it.
  if (!this.itemSize) {
    // Make sure to clean up watchers if we can (see #8178)
    if(this.unwatchItemSize_ && this.unwatchItemSize_ !== angular.noop){
      this.unwatchItemSize_();
    }
    this.unwatchItemSize_ = this.$scope.$watchCollection(
        this.repeatListExpression,
        angular.bind(this, function(items) {
          if (items && items.length) {
            this.readItemSize_();
          }
        }));
    if (!this.$rootScope.$$phase) this.$scope.$digest();

    return;
  } else if (!this.sized) {
    this.items = this.repeatListExpression(this.$scope);
  }

  if (!this.sized) {
    this.unwatchItemSize_();
    this.sized = true;
    this.$scope.$watchCollection(this.repeatListExpression,
        angular.bind(this, function(items, oldItems) {
          if (!this.isVirtualListUpdating_) {
            this.virtualListUpdate_(items, oldItems);
          }
        }));
  }

  this.updateIndexes_();

  if (this.newStartIndex !== this.startIndex ||
      this.newEndIndex !== this.endIndex ||
      this.container.getScrollOffset() > this.container.getScrollSize()) {
    if (this.items instanceof VirtualListModelArrayLike) {
      this.items.$$includeIndexes(this.newStartIndex, this.newEndIndex);
    }
    this.virtualListUpdate_(this.items, this.items);
  }
};


/**
 * Called by the container. Returns the size of a single repeated item.
 * @return {?number} Size of a repeated item.
 */
VirtualListController.prototype.getItemSize = function() {
  return this.itemSize;
};


/**
 * Called by the container. Returns the size of a single repeated item.
 * @return {?number} Size of a repeated item.
 */
VirtualListController.prototype.getItemCount = function() {
  return this.itemsLength;
};


/**
 * Updates the order and visible offset of repeated blocks in response to scrolling
 * or items updates.
 * @private
 */
VirtualListController.prototype.virtualListUpdate_ = function(items, oldItems) {
  this.isVirtualListUpdating_ = true;

  var itemsLength = items && items.length || 0;
  var lengthChanged = false;

  // If the number of items shrank, keep the scroll position.
  if (this.items && itemsLength < this.items.length && this.container.getScrollOffset() !== 0) {
    this.items = items;
    var previousScrollOffset = this.container.getScrollOffset();
    this.container.resetScroll();
    this.container.scrollTo(previousScrollOffset);
  }

  if (itemsLength !== this.itemsLength) {
    lengthChanged = true;
    this.itemsLength = itemsLength;
  }

  this.items = items;
  if (items !== oldItems || lengthChanged) {
    this.updateIndexes_();
  }

  this.parentNode = this.$element[0].parentNode;

  if (lengthChanged) {
    this.container.setScrollSize(itemsLength * this.itemSize);
  }

  // Detach and pool any blocks that are no longer in the viewport.
  Object.keys(this.blocks).forEach(function(blockIndex) {
    var index = parseInt(blockIndex, 10);
    if (index < this.newStartIndex || index >= this.newEndIndex) {
      this.poolBlock_(index);
    }
  }, this);

  // Add needed blocks.
  // For performance reasons, temporarily block browser url checks as we digest
  // the restored block scopes ($$checkUrlChange reads window.location to
  // check for changes and trigger route change, etc, which we don't need when
  // trying to scroll at 60fps).
  this.$browser.$$checkUrlChange = angular.noop;

  var i, block,
      newStartBlocks = [],
      newEndBlocks = [];

  // Collect blocks at the top.
  for (i = this.newStartIndex; i < this.newEndIndex && this.blocks[i] == null; i++) {
    block = this.getBlock_(i);
    this.updateBlock_(block, i);
    newStartBlocks.push(block);
  }

  // Update blocks that are already rendered.
  for (; this.blocks[i] != null; i++) {
    this.updateBlock_(this.blocks[i], i);
  }
  var maxIndex = i - 1;

  // Collect blocks at the end.
  for (; i < this.newEndIndex; i++) {
    block = this.getBlock_(i);
    this.updateBlock_(block, i);
    newEndBlocks.push(block);
  }

  // Attach collected blocks to the document.
  if (newStartBlocks.length) {
    this.parentNode.insertBefore(
        this.domFragmentFromBlocks_(newStartBlocks),
        this.$element[0].nextSibling);
  }
  if (newEndBlocks.length) {
    this.parentNode.insertBefore(
        this.domFragmentFromBlocks_(newEndBlocks),
        this.blocks[maxIndex] && this.blocks[maxIndex].element[0].nextSibling);
  }

  // Restore $$checkUrlChange.
  this.$browser.$$checkUrlChange = this.browserCheckUrlChange;

  this.startIndex = this.newStartIndex;
  this.endIndex = this.newEndIndex;

  this.isVirtualListUpdating_ = false;
};


/**
 * @param {number} index Where the block is to be in the repeated list.
 * @return {!VirtualListController.Block} A new or pooled block to place at the specified index.
 * @private
 */
VirtualListController.prototype.getBlock_ = function(index) {
  if (this.pooledBlocks.length) {
    return this.pooledBlocks.pop();
  }

  var block;
  this.transclude(angular.bind(this, function(clone, scope) {
    block = {
      element: clone,
      new: true,
      scope: scope
    };

    this.updateScope_(scope, index);
    this.parentNode.appendChild(clone[0]);
  }));

  return block;
};


/**
 * Updates and if not in a digest cycle, digests the specified block's scope to the data
 * at the specified index.
 * @param {!VirtualListController.Block} block The block whose scope should be updated.
 * @param {number} index The index to set.
 * @private
 */
VirtualListController.prototype.updateBlock_ = function(block, index) {
  this.blocks[index] = block;

  if (!block.new &&
      (block.scope.$index === index && block.scope[this.repeatName] === this.items[index])) {
    return;
  }
  block.new = false;

  // Update and digest the block's scope.
  this.updateScope_(block.scope, index);

  // Perform digest before reattaching the block.
  // Any resulting synchronous dom mutations should be much faster as a result.
  // This might break some directives, but I'm going to try it for now.
  if (!this.$rootScope.$$phase) {
    block.scope.$digest();
  }
};


/**
 * Updates scope to the data at the specified index.
 * @param {!angular.Scope} scope The scope which should be updated.
 * @param {number} index The index to set.
 * @private
 */
VirtualListController.prototype.updateScope_ = function(scope, index) {
  scope.$index = index;
  scope[this.repeatName] = this.items && this.items[index];
};


/**
 * Pools the block at the specified index (Pulls its element out of the dom and stores it).
 * @param {number} index The index at which the block to pool is stored.
 * @private
 */
VirtualListController.prototype.poolBlock_ = function(index) {
  this.pooledBlocks.push(this.blocks[index]);
  this.parentNode.removeChild(this.blocks[index].element[0]);
  delete this.blocks[index];
};


/**
 * Produces a dom fragment containing the elements from the list of blocks.
 * @param {!Array<!VirtualListController.Block>} blocks The blocks whose elements
 *     should be added to the document fragment.
 * @return {DocumentFragment}
 * @private
 */
VirtualListController.prototype.domFragmentFromBlocks_ = function(blocks) {
  var fragment = this.$document[0].createDocumentFragment();
  blocks.forEach(function(block) {
    fragment.appendChild(block.element[0]);
  });
  return fragment;
};


/**
 * Updates start and end indexes based on length of repeated items and container size.
 * @private
 */
VirtualListController.prototype.updateIndexes_ = function() {
  var itemsLength = this.items ? this.items.length : 0;
  var containerLength = Math.ceil(this.container.getSize() / this.itemSize);

  this.newStartIndex = Math.max(0, Math.min(
      itemsLength - containerLength,
      Math.floor(this.container.getScrollOffset() / this.itemSize)));
  this.newVisibleEnd = this.newStartIndex + containerLength + NUM_EXTRA;
  this.newEndIndex = Math.min(itemsLength, this.newVisibleEnd);
  this.newStartIndex = Math.max(0, this.newStartIndex - NUM_EXTRA);
};

function VirtualListModelArrayLike(model) {
  if (!angular.isFunction(model.getItemAtIndex) ||
      !angular.isFunction(model.getLength)) {
    throw Error('When md-on-demand is enabled, the Object passed to md-virtual-repeat must implement ' +
        'functions getItemAtIndex() and getLength() ');
  }

  this.model = model;
}


VirtualListModelArrayLike.prototype.$$includeIndexes = function(start, end) {
  for (var i = start; i < end; i++) {
    if (!this.hasOwnProperty(i)) {
      this[i] = this.model.getItemAtIndex(i);
    }
  }
  this.length = this.model.getLength();
};


function abstractMethod() {
  throw Error('Non-overridden abstract method called.');
}
