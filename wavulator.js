/*
 * Copyright © 2015 Thomas Galvin <tom at usn.pw>
 * See the COPYING file for more details.
 */

var svg = document.getElementById("view");
var ctlMode = document.getElementById("control-mode");
var ctlReset = document.getElementById("control-reset");
var gridSize = 20, gridWidth = parseInt(800 / gridSize), gridHeight = parseInt(600 / gridSize);
var grid = [];

// creates a DOM (SVG) element for a grid cell at position (x, y) on the grid
function createCell(x, y) {
  var element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  element.setAttribute("cx", gridSize * (x + 0.5));
  element.setAttribute("cy", gridSize * (y + 0.5));
  element.setAttribute("r", 0);
  element.setAttribute("fill", "white");
  element.setAttribute("stroke", "black");
  element.setAttribute("stroke-width", 0);
  svg.appendChild(element);
  
  return element;
}

function setCell(cell, v) {
  if(v < 0) {
    cell.setAttribute("fill", "red");
    cell.setAttribute("r", -v * gridSize / 2);
  } else if(v > 0) {
    cell.setAttribute("fill", "lime");
    cell.setAttribute("r", v * gridSize / 2);
  } else {
    // not going to happen under normal circumstances
    cell.setAttribute("fill", "white");
    cell.setAttribute("r", 0);
  }
}

for(var i = 0; i < gridWidth; i++) {
  var column = [];
  for(var j = 0; j < gridHeight; j++) {
    var cell = {
      element: createCell(i, j),
      state: [0, 0], // [0] = displacement, [1] = velocity
      deltaState: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // change in state at the 
      mass: 0.1
    };
    column.push(cell);
  }
  grid.push(column);
}

var deltaTime = 0.01;

function nextDeltaState(dt, i, j, d) {
  var cell = grid[i][j];
  
  // displacement of the cell
  var disp = cell.state[0] + cell.deltaState[d][0] * dt;
  var vel = cell.state[1] + cell.deltaState[d][1] * dt;
  
  // Ss: Spring attaching this mass to the grid
  // Sn: Spring attaching this mass to neighbouring masses
  
  var cs = 0.016, // damping coefficient for Ss
      ks = 0.1,   // spring constant for Ss
      kn = 1.0;   // spring constant for Sn
  
  // f = -(kx+bv) (Hooke's law for Ss)
  var f = -(disp * ks + vel * cs);
  
  // calculate force from Sn
  if(j > 0) {
    var ncell = grid[i][j - 1];
    f += -(disp - (ncell.state[0] + ncell.deltaState[d][0] * dt)) * kn;
  }
  if(j < gridHeight - 1) {
    var ncell = grid[i][j + 1];
    f += -(disp - (ncell.state[0] + ncell.deltaState[d][0] * dt)) * kn;
  }
  if(i > 0) {
    var ncell = grid[i - 1][j];
    f += -(disp - (ncell.state[0] + ncell.deltaState[d][0] * dt)) * kn;
  }
  if(i < gridWidth - 1) {
    var ncell = grid[i + 1][j];
    f += -(disp - (ncell.state[0] + ncell.deltaState[d][0] * dt)) * kn;
  }
  
  return [cell.state[1], f / cell.mass]; // acceleration = force / mass
}

// time passes since start of simulation
var t = 0;

setInterval(function() {
  var oscillatorValue = Math.sin(4 * t);
  var mode = ctlMode.selectedOptions[0].value;
  if(mode === "side") {
    // top left row is a driving oscillator
    for(var y = 0; y < gridHeight / 3; y++) {
      grid[0][y].state[0] = oscillatorValue;
    }
  } else if(mode === "top") {
    // top middle cell is a driving oscillator
    grid[parseInt(gridWidth / 2)][0].state[0] = oscillatorValue;
  } else if(mode === "center") {
    // middle cell is a driving oscillator
    grid[parseInt(gridWidth / 2)][parseInt(gridHeight / 2)].state[0] = oscillatorValue;
  } else if(mode === "double") {
    // two top middle cell is a driving oscillator
    grid[parseInt(gridWidth / 3)][0].state[0] = oscillatorValue;
    grid[parseInt(gridWidth * 2 / 3)][0].state[0] = oscillatorValue;
  } else if(mode === "double2") {
    // two top middle cell is a driving oscillator, closer together
    grid[parseInt(gridWidth * 2 / 5)][0].state[0] = oscillatorValue;
    grid[parseInt(gridWidth * 3 / 5)][0].state[0] = oscillatorValue;
  }
  
  // 4 iterations of RK4, each sample uses a different dt value
  var deltaTimes = [0, deltaTime / 2, deltaTime / 2, deltaTime];
  // each iteration is done as a separate pass over the grid
  // this is so that, during the later iterations, cells see the
  // neighbouring cells' updated deltaState values rather than the
  // deltaState at the start of the integration process
  for(var i = 0; i < 4; i++) {
    for(var y = 0; y < gridHeight; y++) {
      for(var x = 0; x < gridWidth; x++) {
        var cell = grid[x][y];
        
        cell.deltaState[i + 1] = nextDeltaState(deltaTimes[i], x, y, i);
      }
    }
  }
  
  // one last pass to work out the actual deltaState and update cells accordingly
  for(var j = 0; j < gridHeight; j++) {
    for(var i = 0; i < gridWidth; i++) {
      var cell = grid[i][j];
      
      // calculate change using RK4 method
      var d1 = cell.deltaState[1], d2 = cell.deltaState[2], d3 = cell.deltaState[3], d4 = cell.deltaState[4];
      
      // actual values for change in displacement (dx) and change in velocity (dy)
      var dx = (d1[0] + 2 * (d2[0] + d3[0]) + d4[0]) / 6,
          dv = (d1[1] + 2 * (d2[1] + d3[1]) + d4[1]) / 6;
      
      cell.state[1] = cell.state[1] + dv * deltaTime;
      cell.state[0] = cell.state[0] + dx * deltaTime;
      
      // cap displacement to +/- 1, and cap velocity to +/- 4 to avoid crazy instability
      if(cell.state[0] < -1) cell.state[0] = -1;
      if(cell.state[0] > 1) cell.state[0] = 1;
      if(cell.state[1] < -4) cell.state[1] = -4;
      if(cell.state[1] > 4) cell.state[1] = 4;
      
      //cell.state[0] *= 0.998;
      cell.state[1] *= 0.998;
    }
  }
  t += deltaTime;
}, .01);

// only redraw every 1/10 s
setInterval(function() {
  for(var j = 0; j < gridHeight; j++) {
    for(var i = 0; i < gridWidth; i++) {
      var cell = grid[i][j];
      setCell(cell.element, cell.state[0]);
    }
  }
}, 1000 / 15);

// reset button
ctlReset.addEventListener("click", function() {
  for(var j = 0; j < gridHeight; j++) {
    for(var i = 0; i < gridWidth; i++) {
      var cell = grid[i][j];
      cell.state[0] = cell.state[1] = 0;
    }
  }
  t = 0;
});