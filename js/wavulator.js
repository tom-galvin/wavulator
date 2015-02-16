/*
 * Copyright © 2015 Thomas Galvin <tom at usn.pw>
 * See the COPYING file for more details.
 */

// create a new Wavulator with the given grid, and the
// time scale to run the simulation at (1 is real-time,
// 0.5 is half speed, etc.). High time scales are almost
// guaranteed to be inaccurate
function Wavulator(grid, timeScale) {
  this.grid = grid;
  this.tickInterval = -1;
  this.totalTime = 0;
  this.timeScale = timeScale;
}

// updates the whole simulation 1 step
Wavulator.prototype.update = function() {
  var oscillatorValue = Math.sin(4 * this.totalTime);
  var mode = ctlMode.selectedOptions[0].value;
  if(mode === "side") {
    // top left row is a driving oscillator
    for(var y = 0; y < this.grid.height / 3; y++) {
      this.grid.get(0, y).state[0] = oscillatorValue;
    }
  } else if(mode === "top") {
    // top middle cell is a driving oscillator
    this.grid.get((this.grid.width / 2) | 0, 0).state[0] = oscillatorValue;
  } else if(mode === "center") {
    // middle cell is a driving oscillator
    this.grid.get((this.grid.width / 2) | 0, (grid.height / 2) | 0).state[0] = oscillatorValue;
  } else if(mode === "double") {
    // two top middle cell is a driving oscillator
    this.grid.get((this.grid.width / 3) | 0, 0).state[0] = oscillatorValue;
    this.grid.get((this.grid.width * 2 / 3) | 0, 0).state[0] = oscillatorValue;
  } else if(mode === "double2") {
    // two top middle cell is a driving oscillator, closer together
    this.grid.get((this.grid.width * 2 / 5) | 0, 0).state[0] = oscillatorValue;
    this.grid.get((this.grid.width * 3 / 5) | 0, 0).state[0] = oscillatorValue;
  }
  
  // 4 iterations of RK4, each sample uses a different dt value
  var deltaTimes = [0, this.deltaTime / 2, this.deltaTime / 2, this.deltaTime];
  
  // each iteration is done as a separate pass over the grid
  // this is so that, during the later iterations, cells see the
  // neighbouring cells' updated deltaState values rather than the
  // deltaState at the start of the integration process
  for(var i = 0; i < 4; i++) {
    for(var y = 0; y < this.grid.height; y++) {
      for(var x = 0; x < this.grid.width; x++) {
        this.grid.get(x, y).integrate(deltaTimes[i], i, this.grid);
      }
    }
  }
  
  // one last pass to work out the actual deltaState and update cells accordingly
  for(var j = 0; j < this.grid.height; j++) {
    for(var i = 0; i < this.grid.width; i++) {
      var cell = this.grid.get(i,j);
      
      // calculate change using RK4 method
      var d1 = cell.deltaState[1], d2 = cell.deltaState[2], d3 = cell.deltaState[3], d4 = cell.deltaState[4];
      
      // actual values for change in displacement (dx) and change in velocity (dy)
      var dx = (d1[0] + 2 * (d2[0] + d3[0]) + d4[0]) / 6,
          dv = (d1[1] + 2 * (d2[1] + d3[1]) + d4[1]) / 6;
      
      cell.state[1] = cell.state[1] + dv * this.deltaTime;
      cell.state[0] = cell.state[0] + dx * this.deltaTime;
      
      // cap displacement to +/- 1, and cap velocity to +/- 4 to avoid crazy instability
      if(cell.state[0] < -1) cell.state[0] = -1;
      if(cell.state[0] > 1) cell.state[0] = 1;
      if(cell.state[1] < -4) cell.state[1] = -4;
      if(cell.state[1] > 4) cell.state[1] = 4;
      
      //cell.state[0] *= 0.998;
      cell.state[1] *= 0.998;
    }
  }
  this.totalTime += this.deltaTime;
};

// Stops the tick timer, if it's running
Wavulator.prototype.tickStop = function() {
  if(this.tickInterval !== -1) {
    clearInterval(this.tickInterval);
    this.tickInterval = -1;
  }
}

// Clears the existing tick timer and sets a new one to tick
// every (tps) ticks per second
Wavulator.prototype.tick = function(tps) {
  this.tickStop();
  if(tps > 0) {
    this.deltaTime = this.timeScale / tps;
    var me = this;
    this.tickInterval = setInterval(function() { me.update.bind(me)(); }, 1000 / tps);
  }
}