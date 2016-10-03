<html lang="en" >
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Angular Material style sheet -->
  <link rel="stylesheet" href="http://ajax.googleapis.com/ajax/libs/angular_material/1.1.0/angular-material.min.css">
</head>

<body ng-app="App" ng-cloak ng-controller="Controller as ctrl">

  <h4>Virtual scrolling {{ctrl.dataset.getLength()}}</h4>

  <main>
    <md-virtual-list-container style="height: 300px;">
      <div md-virtual-list="i in ctrl.dataset" md-on-demand>
        <p>Hello {{i.value}}!</p>
      </div>
    </md-virtual-list-container>


  </main>
  
  <!-- Angular Material requires Angular.js Libraries -->
  <script src="http://ajax.googleapis.com/ajax/libs/angularjs/1.5.5/angular.min.js"></script>
  <script src="http://ajax.googleapis.com/ajax/libs/angularjs/1.5.5/angular-animate.min.js"></script>
  <script src="http://ajax.googleapis.com/ajax/libs/angularjs/1.5.5/angular-aria.min.js"></script>
  <script src="http://ajax.googleapis.com/ajax/libs/angularjs/1.5.5/angular-messages.min.js"></script>

  <!-- Angular Material Library -->
  <script src="http://ajax.googleapis.com/ajax/libs/angular_material/1.1.0/angular-material.min.js"></script>
  
  <!-- Your application bootstrap  -->
  <script src="controller.js"></script>
  <script src="list.js"></script>

</body>
</html>
