var constant = require('./constant');
var validation = require('./validation');
var HasPlacementJudger = require('./hasPlacementJudger');
var StoneFlipJudger = require('./stoneFlipJudger');

var RAD_DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];

function ReversiBoard(size, onUpdate) {
    if (size % 2 !== 0 || size <= 0) {
        throw new Error('invalid size');
    }
    this.size = size;
    this.fnOnUpdate = onUpdate;
    this.clearBoard();
}

/**
 * Clear the board to initial state.
 */
ReversiBoard.prototype.clearBoard = function () {
    this.board = [];
    this.order = [];
    for (var i = 0; i < this.size; i++) {
        var boardRow = [];
        var orderRow = [];
        for (var j = 0; j < this.size; j++) {
            boardRow.push(constant.STATE_EMPTY);
            orderRow.push(0);
        }
        this.board.push(boardRow);
        this.order.push(orderRow);
    }
    var beginPos = this.size / 2 - 1;
    this.board[beginPos][beginPos] = constant.STATE_WHITE;
    this.board[beginPos][beginPos + 1] = constant.STATE_BLACK;
    this.board[beginPos + 1][beginPos] = constant.STATE_BLACK;
    this.board[beginPos + 1][beginPos + 1] = constant.STATE_WHITE;
    this.order[beginPos][beginPos] = 0;
    this.order[beginPos][beginPos + 1] = 0;
    this.order[beginPos + 1][beginPos] = 0;
    this.order[beginPos + 1][beginPos + 1] = 0;
    this.currentOrder = 0;
};

/**
 * Check whether there is an available placement for a specific player.
 */
ReversiBoard.prototype.hasAvailablePlacement = function (side) {
    validation.checkPlayerSide(side);
    var iterations = [
        // 0         1         2             3             4        5
        // startRow, startCol, directionRow, directionCol, nextRow, nextCol
        [0, 0, 0, 1, 1, 0],               // right
        [0, 0, 1, 0, 0, 1],               // down
        [0, this.size - 1, 1, 1, 0, -1],  // right-down
        [1, 0, 1, 1, 1, 0],               // right-down
        [0, 0, 1, -1, 0, 1],              // left-down
        [1, this.size - 1, 1, -1, 1, 0],  // left-down
    ];
    var judger = new HasPlacementJudger(side);
    for (var i = 0; i < iterations.length; i++) {
        var iteration = iterations[i];
        var row = iteration[0];
        var col = iteration[1];
        while (row >= 0 && col >= 0 && row < this.size && col < this.size) {
            var cRow = row;
            var cCol = col;
            // Asc order
            judger.reset();
            while (cRow >= 0 && cCol >= 0 && cRow < this.size && cCol < this.size) {
                var result = judger.next(this.board[cRow][cCol]);
                if (result) {
                    return true;
                }
                cRow += iteration[2];
                cCol += iteration[3];
            }
            // Desc order
            cRow -= iteration[2];
            cCol -= iteration[3];
            judger.reset();
            while (cRow >= 0 && cCol >= 0 && cRow < this.size && cCol < this.size) {
                var result = judger.next(this.board[cRow][cCol]);
                if (result) {
                    return true;
                }
                cRow -= iteration[2];
                cCol -= iteration[3];
            }
            // Prepare for next iteration
            row += iteration[4];
            col += iteration[5];
        }
    }
    return false;
};

/**
 * Check whether a stone can be placed at a specified place.
 */
ReversiBoard.prototype.canPlaceAt = function (side, row, col) {
    validation.checkPlayerSide(side);
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) {
        return false;
    }
    if (this.board[row][col] !== constant.STATE_EMPTY) {
        return false;
    }
    var judger = new StoneFlipJudger(side);
    for (var i = 0; i < RAD_DIRECTIONS.length; i++) {
        var direction = RAD_DIRECTIONS[i];
        var cRow = row + direction[0];
        var cCol = col + direction[1];
        judger.reset();
        while (cRow >= 0 && cCol >= 0 && cRow < this.size && cCol < this.size) {
            var result = judger.next(this.board[cRow][cCol]);
            if (result === 0) {
                break;
            } else if (result > 0) {
                return true;
            }
            // Else: result === -1
            cRow += direction[0];
            cCol += direction[1];
        }
    }
    return false;
};

ReversiBoard.prototype._placeAt = function (row, col, side, order) {
    this.board[row][col] = side;
    if (order !== undefined) {
        this.order[row][col] = order;
    }
    this.fnOnUpdate && this.fnOnUpdate(row, col, side, order);
};

/**
 * Place a stone at specific position.
 *
 * The position must be validated via canPlaceAt before calling this function,
 * otherwise the behavior is unexpected.
 */
ReversiBoard.prototype.placeAt = function (side, row, col) {
    validation.checkPlayerSide(side);
    this.currentOrder++;
    this._placeAt(row, col, side, this.currentOrder);
    var judger = new StoneFlipJudger(side);
    for (var i = 0; i < RAD_DIRECTIONS.length; i++) {
        var direction = RAD_DIRECTIONS[i];
        // Pre-walk to see how many stones can be flipped
        var flipStones = 0;
        var cRow = row + direction[0];
        var cCol = col + direction[1];
        judger.reset();
        while (cRow >= 0 && cCol >= 0 && cRow < this.size && cCol < this.size) {
            var result = judger.next(this.board[cRow][cCol]);
            if (result >= 0) {
                flipStones = result;
                break;
            }
            cRow += direction[0];
            cCol += direction[1];
        }
        // flip stones
        if (flipStones > 0) {
            var cRow = row;
            var cCol = col;
            while (flipStones > 0) {
                cRow += direction[0];
                cCol += direction[1];
                this._placeAt(cRow, cCol, side);
                flipStones--;
            }
        }
    }
};

/**
 * Count stones.
 */
ReversiBoard.prototype.count = function () {
    var analytics = {};
    analytics[constant.STATE_EMPTY] = 0;
    analytics[constant.STATE_BLACK] = 0;
    analytics[constant.STATE_WHITE] = 0;
    for (var i = 0; i < this.size; i++) {
        for (var j = 0; j < this.size; j++) {
            analytics[this.board[i][j]]++;
        }
    }
    return analytics;
};

module.exports = {
    Board: ReversiBoard,
    STATE_EMPTY: constant.STATE_EMPTY,
    STATE_BLACK: constant.STATE_BLACK,
    STATE_WHITE: constant.STATE_WHITE,
};
