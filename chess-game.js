(function () {
  var boardEl = document.getElementById('board');
  if (!boardEl) return;

  // ─── ENGINE ──────────────────────────────────────────────
  var PIECE_DIR_CALC = 0;
  var Utils = {
    colToInt: function (col) { return Board.COLS.indexOf(col); },
    rowToInt: function (row) { return Board.ROWS.indexOf(row); },
    intToCol: function (int) { return Board.COLS[int]; },
    intToRow: function (int) { return Board.ROWS[int]; },
    getInitialBoardTiles: function (parent, handler) {
      var tiles = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {} };
      var board = parent.querySelector('.board') || parent;
      for (var i = 0; i < 8; i++) {
        var row = document.createElement('div');
        row.className = 'row';
        board.appendChild(row);
        for (var j = 0; j < 8; j++) {
          var tile = document.createElement('button');
          tile.className = 'tile';
          (function (r, c) {
            tile.addEventListener('click', function () { handler({ row: r, col: c }); });
          })(Utils.intToRow(i), Utils.intToCol(j));
          row.appendChild(tile);
          tiles[Utils.intToRow(i)][Utils.intToCol(j)] = tile;
        }
      }
      return tiles;
    },
    getInitialBoardPieces: function (parent, pieces) {
      var boardPieces = {};
      var container = document.createElement('div');
      container.className = 'pieces';
      parent.appendChild(container);
      for (var id in pieces) {
        var bp = document.createElement('div');
        bp.className = 'piece ' + pieces[id].data.player.toLowerCase();
        bp.innerHTML = pieces[id].shape();
        container.appendChild(bp);
        boardPieces[id] = bp;
      }
      return boardPieces;
    },
    getInitialBoardState: function (construct) {
      construct = construct || function () { return undefined; };
      var blankRow = function () { return { A: construct(), B: construct(), C: construct(), D: construct(), E: construct(), F: construct(), G: construct(), H: construct() }; };
      return { 1: blankRow(), 2: blankRow(), 3: blankRow(), 4: blankRow(), 5: blankRow(), 6: blankRow(), 7: blankRow(), 8: blankRow() };
    }
  };

  var Shape = {
    shape: function (player, piece) {
      return '<svg class="' + player + '" width="170" height="170" viewBox="0 0 170 170" fill="none" xmlns="http://www.w3.org/2000/svg"><use href="#' + piece + '" /></svg>';
    },
    shapeBishop: function (p) { return Shape.shape(p, 'bishop'); },
    shapeKing: function (p) { return Shape.shape(p, 'king'); },
    shapeKnight: function (p) { return Shape.shape(p, 'knight'); },
    shapePawn: function (p) { return Shape.shape(p, 'pawn'); },
    shapeQueen: function (p) { return Shape.shape(p, 'queen'); },
    shapeRook: function (p) { return Shape.shape(p, 'rook'); }
  };

  var Constraints = {
    generate: function (args, resultingChecks) {
      var method;
      var pp = args.piecePositions;
      if (pp[args.piece.data.id].active) {
        switch (args.piece.data.type) {
          case 'BISHOP': method = Constraints.constraintsBishop; break;
          case 'KING': method = Constraints.constraintsKing; break;
          case 'KNIGHT': method = Constraints.constraintsKnight; break;
          case 'PAWN': method = Constraints.constraintsPawn; break;
          case 'QUEEN': method = Constraints.constraintsQueen; break;
          case 'ROOK': method = Constraints.constraintsRook; break;
        }
      }
      var result = method ? method(args) : { moves: [], captures: [] };
      if (resultingChecks) {
        var mi = args.moveIndex + 1;
        result.moves = result.moves.filter(function (loc) { return !resultingChecks({ piece: args.piece, location: loc, capture: false, moveIndex: mi }).length; });
        result.captures = result.captures.filter(function (loc) { return !resultingChecks({ piece: args.piece, location: loc, capture: true, moveIndex: mi }).length; });
      }
      return result;
    },
    constraintsBishop: function (args) { return Constraints.constraintsDiagonal(args); },
    constraintsDiagonal: function (args) {
      var r = { moves: [], captures: [] };
      Constraints.runUntil(args.piece.dirNW.bind(args.piece), r, args);
      Constraints.runUntil(args.piece.dirNE.bind(args.piece), r, args);
      Constraints.runUntil(args.piece.dirSW.bind(args.piece), r, args);
      Constraints.runUntil(args.piece.dirSE.bind(args.piece), r, args);
      return r;
    },
    constraintsKing: function (args) {
      var piece = args.piece, moves = [], captures = [];
      var locs = [
        piece.dirN(1, args.piecePositions), piece.dirNE(1, args.piecePositions), piece.dirE(1, args.piecePositions),
        piece.dirSE(1, args.piecePositions), piece.dirS(1, args.piecePositions), piece.dirSW(1, args.piecePositions),
        piece.dirW(1, args.piecePositions), piece.dirNW(1, args.piecePositions)
      ];
      if (args.kingCastles) {
        args.kingCastles(piece).forEach(function (p) { moves.push(p); });
      }
      locs.forEach(function (loc) {
        var v = Constraints.relationshipToTile(loc, args);
        if (v === 'BLANK') moves.push(loc);
        else if (v === 'ENEMY') captures.push(loc);
      });
      return { moves: moves, captures: captures };
    },
    constraintsKnight: function (args) {
      var p = args.piece, moves = [], captures = [];
      var locs = [
        p.dir(1, 2, args.piecePositions), p.dir(1, -2, args.piecePositions), p.dir(2, 1, args.piecePositions), p.dir(2, -1, args.piecePositions),
        p.dir(-1, 2, args.piecePositions), p.dir(-1, -2, args.piecePositions), p.dir(-2, 1, args.piecePositions), p.dir(-2, -1, args.piecePositions)
      ];
      locs.forEach(function (loc) {
        var v = Constraints.relationshipToTile(loc, args);
        if (v === 'BLANK') moves.push(loc);
        else if (v === 'ENEMY') captures.push(loc);
      });
      return { moves: moves, captures: captures };
    },
    constraintsOrthangonal: function (args) {
      var p = args.piece, r = { moves: [], captures: [] };
      Constraints.runUntil(p.dirN.bind(p), r, args);
      Constraints.runUntil(p.dirE.bind(p), r, args);
      Constraints.runUntil(p.dirS.bind(p), r, args);
      Constraints.runUntil(p.dirW.bind(p), r, args);
      return r;
    },
    constraintsPawn: function (args) {
      var p = args.piece, pp = args.piecePositions, moves = [], captures = [];
      var n1 = p.dirN(1, pp), n2 = p.dirN(2, pp);
      if (Constraints.relationshipToTile(n1, args) === 'BLANK') {
        moves.push(n1);
        if (!p.moves.length && Constraints.relationshipToTile(n2, args) === 'BLANK') moves.push(n2);
      }
      [
        [p.dirNW(1, pp), p.dirW(1, pp)],
        [p.dirNE(1, pp), p.dirE(1, pp)]
      ].forEach(function (pair) {
        var loc = pair[0], ep = pair[1];
        var scr = Constraints.relationshipToTile(loc, args);
        var ecr = Constraints.relationshipToTile(ep, args);
        if (scr === 'ENEMY') captures.push(loc);
        else if (p.moves.length > 0 && ecr === 'ENEMY') {
          var epRow = ep.row === (p.playerWhite() ? '5' : '4');
          var other = Constraints.locationToPiece(ep, args);
          if (epRow && other && other.data.type === 'PAWN' && other.moves.length === 1 && other.moves[0] === args.moveIndex - 1) {
            loc.capture = Object.assign({}, ep);
            captures.push(loc);
          }
        }
      });
      return { moves: moves, captures: captures };
    },
    constraintsQueen: function (args) {
      var d = Constraints.constraintsDiagonal(args);
      var o = Constraints.constraintsOrthangonal(args);
      return { moves: d.moves.concat(o.moves), captures: d.captures.concat(o.captures) };
    },
    constraintsRook: function (args) { return Constraints.constraintsOrthangonal(args); },
    locationToPiece: function (loc, args) {
      if (!loc) return undefined;
      var row = args.state[loc.row];
      var id = row ? row[loc.col] : undefined;
      return args.pieces[id];
    },
    relationshipToTile: function (loc, args) {
      if (!loc) return undefined;
      var occ = Constraints.locationToPiece(loc, args);
      if (occ) return occ.data.player === args.piece.data.player ? 'FRIEND' : 'ENEMY';
      return 'BLANK';
    },
    runUntil: function (locFn, response, args) {
      var inc = 1, loc = locFn(inc++, args.piecePositions);
      while (loc) {
        var abort = false;
        var rel = Constraints.relationshipToTile(loc, args);
        if (rel === 'ENEMY') { response.captures.push(loc); abort = true; }
        else if (rel === 'FRIEND') abort = true;
        else response.moves.push(loc);
        loc = abort ? undefined : locFn(inc++, args.piecePositions);
      }
    }
  };

  function Piece(data) {
    this.moves = [];
    this.promoted = false;
    this.updateShape = false;
    this.data = data;
  }
  Piece.prototype = {
    get orientation() { return this.data.player === 'BLACK' ? -1 : 1; },
    dirN: function (s, p) { return this.dir(s, 0, p); },
    dirS: function (s, p) { return this.dir(-s, 0, p); },
    dirW: function (s, p) { return this.dir(0, -s, p); },
    dirE: function (s, p) { return this.dir(0, s, p); },
    dirNW: function (s, p) { return this.dir(s, -s, p); },
    dirNE: function (s, p) { return this.dir(s, s, p); },
    dirSW: function (s, p) { return this.dir(-s, -s, p); },
    dirSE: function (s, p) { return this.dir(-s, s, p); },
    dir: function (sr, sc, pos) {
      PIECE_DIR_CALC++;
      var row = Utils.rowToInt(pos[this.data.id].row) + this.orientation * sr;
      var col = Utils.colToInt(pos[this.data.id].col) + this.orientation * sc;
      if (row >= 0 && row <= 7 && col >= 0 && col <= 7) return { row: Utils.intToRow(row), col: Utils.intToCol(col) };
      return undefined;
    },
    move: function (mi) { this.moves.push(mi); },
    options: function (mi, state, pieces, pp, rc, kc) { return Constraints.generate({ moveIndex: mi, state: state, piece: this, pieces: pieces, piecePositions: pp, kingCastles: kc }, rc); },
    playerBlack: function () { return this.data.player === 'BLACK'; },
    playerWhite: function () { return this.data.player === 'WHITE'; },
    promote: function (type) { type = type || 'QUEEN'; this.data.type = type; this.promoted = true; this.updateShape = true; },
    shape: function () {
      var p = this.data.player.toLowerCase();
      switch (this.data.type) {
        case 'BISHOP': return Shape.shapeBishop(p);
        case 'KING': return Shape.shapeKing(p);
        case 'KNIGHT': return Shape.shapeKnight(p);
        case 'PAWN': return Shape.shapePawn(p);
        case 'QUEEN': return Shape.shapeQueen(p);
        case 'ROOK': return Shape.shapeRook(p);
      }
    }
  };

  function Board(pieces, piecePositions) {
    this.checksBlack = [];
    this.checksWhite = [];
    this.piecesTilesCaptures = {};
    this.piecesTilesMoves = {};
    this.tilesPiecesBlackCaptures = Utils.getInitialBoardState(function () { return []; });
    this.tilesPiecesBlackMoves = Utils.getInitialBoardState(function () { return []; });
    this.tilesPiecesWhiteCaptures = Utils.getInitialBoardState(function () { return []; });
    this.tilesPiecesWhiteMoves = Utils.getInitialBoardState(function () { return []; });
    this.pieceIdsBlack = [];
    this.pieceIdsWhite = [];
    this.state = {};
    this.pieces = pieces;
    for (var id in pieces) {
      if (pieces[id].playerWhite()) this.pieceIdsWhite.push(id);
      else this.pieceIdsBlack.push(id);
    }
    this.piecePositions = piecePositions;
    this.initializeState();
    this.piecesUpdate(0);
  }
  Board.COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  Board.ROWS = ['1', '2', '3', '4', '5', '6', '7', '8'];
  Board.prototype = {
    initializeState: function () {
      for (var id in this.pieces) {
        var pp = this.piecePositions[id];
        if (pp.active) {
          this.state[pp.row] = this.state[pp.row] || {};
          this.state[pp.row][pp.col] = id;
        }
      }
    },
    kingCastles: function (king) {
      var castles = [];
      if (king.moves.length) return castles;
      var white = king.playerWhite();
      var moves = white ? this.tilesPiecesBlackMoves : this.tilesPiecesWhiteMoves;
      var row = white ? '1' : '8';
      var check = function (rc, cols) {
        var rookId = rc + row;
        var rook = this.pieces[rookId];
        if (this.piecePositions[rookId].active && rook.moves.length === 0) {
          var can = true;
          cols.forEach(function (col) {
            if (this.state[row][col]) can = false;
            else if (moves[row][col].length) can = false;
          }, this);
          if (can) castles.push({ col: cols[1], row: row, castles: rc });
        }
      }.bind(this);
      if (!this.pieces['A' + row].moves.length) check('A', ['D', 'C', 'B']);
      if (!this.pieces['H' + row].moves.length) check('H', ['F', 'G']);
      return castles;
    },
    kingCheckStates: function (kp, captures, pp) {
      return captures[kp.row][kp.col].map(function (id) { return pp[id]; }).filter(function (pos) { return pos.active; });
    },
    pieceCalculateMoves: function (id, mi, state, pp, ptc, ptm, tpc, tpm, rc, kc) {
      var result = this.pieces[id].options(mi, state, this.pieces, pp, rc, kc);
      ptc[id] = Array.from(result.captures);
      ptm[id] = Array.from(result.moves);
      result.captures.forEach(function (l) { tpc[l.row][l.col].push(id); });
      result.moves.forEach(function (l) { tpm[l.row][l.col].push(id); });
    },
    pieceCapture: function (piece) {
      var id = piece.data.id;
      var pos = this.piecePositions[id];
      this.state[pos.row][pos.col] = undefined;
      delete pos.col; delete pos.row;
      pos.active = false;
    },
    pieceMove: function (piece, loc) {
      var id = piece.data.id;
      var pos = this.piecePositions[id];
      this.state[pos.row][pos.col] = undefined;
      this.state[loc.row][loc.col] = id;
      pos.row = loc.row; pos.col = loc.col;
      if (piece.data.type === 'PAWN' && (loc.row === '8' || loc.row === '1')) piece.promote();
    },
    piecesUpdate: function (mi) {
      this.tilesPiecesBlackCaptures = Utils.getInitialBoardState(function () { return []; });
      this.tilesPiecesBlackMoves = Utils.getInitialBoardState(function () { return []; });
      this.tilesPiecesWhiteCaptures = Utils.getInitialBoardState(function () { return []; });
      this.tilesPiecesWhiteMoves = Utils.getInitialBoardState(function () { return []; });
      var self = this;
      this.pieceIdsBlack.forEach(function (id) { self.pieceCalculateMoves(id, mi, self.state, self.piecePositions, self.piecesTilesCaptures, self.piecesTilesMoves, self.tilesPiecesBlackCaptures, self.tilesPiecesBlackMoves, self.resultingChecks.bind(self), self.kingCastles.bind(self)); });
      this.pieceIdsWhite.forEach(function (id) { self.pieceCalculateMoves(id, mi, self.state, self.piecePositions, self.piecesTilesCaptures, self.piecesTilesMoves, self.tilesPiecesWhiteCaptures, self.tilesPiecesWhiteMoves, self.resultingChecks.bind(self), self.kingCastles.bind(self)); });
      this.checksBlack = this.kingCheckStates(this.piecePositions.E1, this.tilesPiecesBlackCaptures, this.piecePositions);
      this.checksWhite = this.kingCheckStates(this.piecePositions.E8, this.tilesPiecesWhiteCaptures, this.piecePositions);
    },
    resultingChecks: function (args) {
      var tpc = Utils.getInitialBoardState(function () { return []; });
      var tpm = Utils.getInitialBoardState(function () { return []; });
      var ptc = {}, ptm = {};
      var state = JSON.parse(JSON.stringify(this.state));
      var pp = JSON.parse(JSON.stringify(this.piecePositions));
      if (args.capture) {
        var loc = args.location.capture || args.location;
        var capturedId = state[loc.row][loc.col];
        if (this.pieces[capturedId].data.type !== 'KING') { delete pp[capturedId].col; delete pp[capturedId].row; pp[capturedId].active = false; }
      }
      var id = args.piece.data.id;
      state[pp[id].row][pp[id].col] = undefined;
      state[args.location.row][args.location.col] = id;
      pp[id].row = args.location.row; pp[id].col = args.location.col;
      var ids = args.piece.playerWhite() ? this.pieceIdsBlack : this.pieceIdsWhite;
      var king = args.piece.playerWhite() ? pp.E1 : pp.E8;
      var self = this;
      ids.forEach(function (pid) { self.pieceCalculateMoves(pid, 0, state, pp, ptc, ptm, tpc, tpm); });
      return this.kingCheckStates(king, tpc, pp);
    },
    tileEach: function (cb) {
      for (var ri = 0; ri < 8; ri++) {
        var row = Board.ROWS[ri];
        for (var ci = 0; ci < 8; ci++) {
          var col = Board.COLS[ci];
          var piece = this.state[row] ? this.pieces[this.state[row][col]] : undefined;
          var moves = piece ? this.piecesTilesMoves[piece.data.id] : undefined;
          var captures = piece ? this.piecesTilesCaptures[piece.data.id] : undefined;
          cb({ row: row, col: col }, piece, moves, captures);
        }
      }
    },
    tileFind: function (loc) { var id = this.state[loc.row] ? this.state[loc.row][loc.col] : undefined; return this.pieces[id]; },
    toShortCode: function () {
      var pa = [], pd = [];
      for (var id in this.piecePositions) {
        var pp = this.piecePositions[id];
        var pos = pp.col + pp.row;
        var moves = this.pieces[id].moves;
        var pc = this.pieces[id].promoted ? 'P' : '';
        var mc = moves > 9 ? '9' : moves > 1 ? moves.toString() : '';
        if (pp.active) {
          pa.push(pc + id + (id === pos ? '' : pos) + mc);
          if (id !== pos || moves > 0) pd.push(pc + id + pos + mc);
        } else {
          if (id !== 'BQ' && id !== 'WQ') pd.push(pc + id + 'X');
        }
      }
      return pa.join(',').length > pd.join(',').length ? 'X' + pd.join(',') : pa.join(',');
    }
  };

  var initialPositions = {};
  (function () {
    var pos = {
      A8: '8A', B8: '8B', C8: '8C', D8: '8D', E8: '8E', F8: '8F', G8: '8G', H8: '8H',
      A7: '7A', B7: '7B', C7: '7C', D7: '7D', E7: '7E', F7: '7F', G7: '7G', H7: '7H',
      A2: '2A', B2: '2B', C2: '2C', D2: '2D', E2: '2E', F2: '2F', G2: '2G', H2: '2H',
      A1: '1A', B1: '1B', C1: '1C', D1: '1D', E1: '1E', F1: '1F', G1: '1G', H1: '1H'
    };
    for (var k in pos) initialPositions[k] = { active: true, row: pos[k].charAt(0), col: pos[k].charAt(1) };
    var inactive = ['A3','B3','C3','D3','E3','F3','G3','H3','A4','B4','C4','D4','E4','F4','G4','H4','A5','B5','C5','D5','E5','F5','G5','H5','A6','B6','C6','D6','E6','F6','G6','H6'];
    inactive.forEach(function (k) { initialPositions[k] = { active: false }; });
  })();

  function getInitialPieces() {
    var p = {};
    var bp = function (id, player, type) { p[id] = new Piece({ id: id, player: player, type: type }); };
    var W = 'WHITE', B = 'BLACK';
    bp('A8', B, 'ROOK'); bp('B8', B, 'KNIGHT'); bp('C8', B, 'BISHOP'); bp('D8', B, 'QUEEN'); bp('E8', B, 'KING'); bp('F8', B, 'BISHOP'); bp('G8', B, 'KNIGHT'); bp('H8', B, 'ROOK');
    bp('A7', B, 'PAWN'); bp('B7', B, 'PAWN'); bp('C7', B, 'PAWN'); bp('D7', B, 'PAWN'); bp('E7', B, 'PAWN'); bp('F7', B, 'PAWN'); bp('G7', B, 'PAWN'); bp('H7', B, 'PAWN');
    bp('A2', W, 'PAWN'); bp('B2', W, 'PAWN'); bp('C2', W, 'PAWN'); bp('D2', W, 'PAWN'); bp('E2', W, 'PAWN'); bp('F2', W, 'PAWN'); bp('G2', W, 'PAWN'); bp('H2', W, 'PAWN');
    bp('A1', W, 'ROOK'); bp('B1', W, 'KNIGHT'); bp('C1', W, 'BISHOP'); bp('D1', W, 'QUEEN'); bp('E1', W, 'KING'); bp('F1', W, 'BISHOP'); bp('G1', W, 'KNIGHT'); bp('H1', W, 'ROOK');
    return p;
  }

  function Game(pieces, piecePositions, turn) {
    turn = turn || 'WHITE';
    this.active = null;
    this.activePieceOptions = [];
    this.moveIndex = 0;
    this.moves = [];
    this.turn = turn;
    this.board = new Board(pieces, piecePositions);
  }
  Game.prototype = {
    activate: function (location) {
      var tilePiece = this.board.tileFind(location);
      if (tilePiece && !this.active && tilePiece.data.player !== this.turn) { this.active = null; return { type: 'INVALID' }; }
      else if (this.active) {
        var activeId = this.active.data.id;
        this.active = null;
        var vp = null;
        for (var i = 0; i < this.activePieceOptions.length; i++) {
          if (this.activePieceOptions[i].col === location.col && this.activePieceOptions[i].row === location.row) { vp = this.activePieceOptions[i]; break; }
        }
        var valid = !!vp;
        this.activePieceOptions = [];
        var cap = vp && vp.capture ? this.board.tileFind(vp.capture) : tilePiece;
        if (cap) {
          var capId = cap.data.id;
          if (capId === activeId) return { type: 'CANCEL' };
          else if (valid) { this.capture(activeId, capId, location); return { type: 'CAPTURE', activePieceId: activeId, capturedPieceId: capId, captures: [location] }; }
          else if (cap.data.player !== this.turn) return { type: 'CANCEL' };
        } else if (valid) {
          var castledId = this.move(activeId, location);
          return { type: 'MOVE', activePieceId: activeId, moves: [location], castledId: castledId };
        } else return { type: 'CANCEL' };
      }
      if (tilePiece) {
        var tileId = tilePiece.data.id;
        var moves = this.board.piecesTilesMoves[tileId];
        var captures = this.board.piecesTilesCaptures[tileId];
        if (!moves.length && !captures.length) return { type: 'INVALID' };
        this.active = tilePiece;
        this.activePieceOptions = moves.concat(captures);
        return { type: 'TOUCH', captures: captures, moves: moves, activePieceId: tileId };
      } else { this.activePieceOptions = []; return { type: 'CANCEL' }; }
    },
    capture: function (cpId, capId, loc) { this.board.pieceCapture(this.board.pieces[capId]); this.move(cpId, loc, true); },
    handleCastling: function (piece, loc) {
      if (piece.data.type !== 'KING' || piece.moves.length || loc.row !== (piece.playerWhite() ? '1' : '8') || (loc.col !== 'C' && loc.col !== 'G')) return;
      return (loc.col === 'C' ? 'A' : 'H') + loc.row;
    },
    move: function (pieceId, loc, capture) {
      capture = capture || false;
      var piece = this.board.pieces[pieceId];
      var castledId = this.handleCastling(piece, loc);
      piece.move(this.moveIndex);
      if (castledId) {
        var castled = this.board.pieces[castledId];
        castled.move(this.moveIndex);
        this.board.pieceMove(castled, { col: loc.col === 'C' ? 'D' : 'F', row: loc.row });
        this.moves.push(pieceId + 'O' + loc.col + loc.row);
      } else this.moves.push(pieceId + (capture ? 'x' : '') + loc.col + loc.row);
      this.moveIndex++;
      this.board.pieceMove(piece, loc);
      this.turn = this.turn === 'WHITE' ? 'BLACK' : 'WHITE';
      this.board.piecesUpdate(this.moveIndex);
      var state = this.moveResultState();
      if (!state.moves && !state.captures) alert(state.stalemate ? 'Stalemate!' : (this.turn === 'WHITE' ? 'Black' : 'White') + ' Wins!');
      return castledId;
    },
    moveResultState: function () {
      var mw = 0, cw = 0, mb = 0, cb = 0;
      this.board.tileEach(function (loc) {
        mw += this.board.tilesPiecesWhiteMoves[loc.row][loc.col].length;
        cw += this.board.tilesPiecesWhiteCaptures[loc.row][loc.col].length;
        mb += this.board.tilesPiecesBlackMoves[loc.row][loc.col].length;
        cb += this.board.tilesPiecesBlackCaptures[loc.row][loc.col].length;
      }.bind(this));
      var ab = this.board.pieceIdsBlack.filter(function (id) { return this.board.piecePositions[id].active; }.bind(this)).length;
      var aw = this.board.pieceIdsWhite.filter(function (id) { return this.board.piecePositions[id].active; }.bind(this)).length;
      var moves = this.turn === 'WHITE' ? mw : mb;
      var captures = this.turn === 'WHITE' ? cw : cb;
      var noMoves = mw + cw + mb + cb === 0;
      var checked = !!this.board[this.turn === 'WHITE' ? 'checksBlack' : 'checksWhite'].length;
      var onlyKings = ab === 1 && aw === 1;
      var stalemate = onlyKings || noMoves || (moves + captures === 0 && !checked);
      return { turn: this.turn, checked: checked, moves: moves, captures: captures, stalemate: stalemate };
    },
    randomMove: function () {
      if (this.active) {
        if (this.activePieceOptions.length) {
          var opt = this.activePieceOptions[Math.floor(Math.random() * this.activePieceOptions.length)];
          return { col: opt.col, row: opt.row };
        } else {
          var pos = this.board.piecePositions[this.active.data.id];
          return { col: pos.col, row: pos.row };
        }
      } else {
        var ids = this.turn === 'WHITE' ? this.board.pieceIdsWhite : this.board.pieceIdsBlack;
        var positions = ids.map(function (id) {
          var m = this.board.piecesTilesMoves[id];
          var c = this.board.piecesTilesCaptures[id];
          return (m.length || c.length) ? this.board.piecePositions[id] : undefined;
        }.bind(this)).filter(function (p) { return p && p.active; });
        if (!positions.length) return { col: 'E', row: '1' };
        var rem = positions[Math.floor(Math.random() * positions.length)];
        return { col: rem.col, row: rem.row };
      }
    }
  };

  function View(element, game, perspective) {
    this.element = element;
    this.game = game;
    this.setPerspective(perspective || game.turn);
    this.tiles = Utils.getInitialBoardTiles(element, this.handleTileClick.bind(this));
    this.pieces = Utils.getInitialBoardPieces(element, this.game.board.pieces);
    this.drawPiecePositions();
  }
  View.prototype = {
    drawPiecePositions: function (moves, moveInner) {
      moves = moves || [];
      moveInner = moveInner || '';
      document.querySelector('#game-chess .gc-modal').style.setProperty('--color-background', 'var(--color-' + this.game.turn.toLowerCase() + ')');
      var other = this.game.turn === 'WHITE' ? 'turn-black' : 'turn-white';
      var current = this.game.turn === 'WHITE' ? 'turn-white' : 'turn-black';
      this.element.classList.add(current);
      this.element.classList.remove(other);
      if (moves.length) this.element.classList.add('touching');
      else this.element.classList.remove('touching');
      var keys = {};
      moves.forEach(function (m) { keys[m.row + '-' + m.col] = true; });
      var self = this;
      this.game.board.tileEach(function (loc, piece, pieceMoves, pieceCaptures) {
        var tile = self.tiles[loc.row][loc.col];
        var move = keys[loc.row + '-' + loc.col] ? moveInner : '';
        var format = function (id) { return self.game.board.pieces[id].shape(); };
        tile.innerHTML =
          '<div class="move">' + move + '</div>' +
          '<div class="moves">' + self.game.board.tilesPiecesBlackMoves[loc.row][loc.col].map(function (id) { return format(id); }).join('') + self.game.board.tilesPiecesWhiteMoves[loc.row][loc.col].map(function (id) { return format(id); }).join('') + '</div>' +
          '<div class="captures">' + self.game.board.tilesPiecesBlackCaptures[loc.row][loc.col].map(function (id) { return format(id); }).join('') + self.game.board.tilesPiecesWhiteCaptures[loc.row][loc.col].map(function (id) { return format(id); }).join('') + '</div>';
        if (piece) {
          tile.classList.add('occupied');
          var pe = self.pieces[piece.data.id];
          pe.style.setProperty('--pos-col', Utils.colToInt(loc.col).toString());
          pe.style.setProperty('--pos-row', Utils.rowToInt(loc.row).toString());
          pe.style.setProperty('--scale', '1');
          pe.classList[(pieceMoves && pieceMoves.length) ? 'add' : 'remove']('can-move');
          pe.classList[(pieceCaptures && pieceCaptures.length) ? 'add' : 'remove']('can-capture');
          if (piece.updateShape) { piece.updateShape = false; pe.innerHTML = piece.shape(); }
        } else tile.classList.remove('occupied');
      });
    },
    drawCapturedPiece: function (id) {
      var pe = this.pieces[id];
      pe.style.setProperty('--transition-delay', 'var(--transition-duration)');
      pe.style.removeProperty('--pos-col');
      pe.style.removeProperty('--pos-row');
      pe.style.setProperty('--scale', '0');
    },
    drawPositions: function (moves, captures) {
      moves && moves.forEach(function (loc) {
        this.tiles[loc.row][loc.col].classList.add('highlight-move');
        var p = this.game.board.tileFind({ row: loc.row, col: loc.col });
        p && this.pieces[p.data.id].classList.add('highlight-move');
      }.bind(this));
      captures && captures.forEach(function (loc) {
        if (loc.capture) { loc = loc.capture; }
        this.tiles[loc.row][loc.col].classList.add('highlight-capture');
        var p = this.game.board.tileFind({ row: loc.row, col: loc.col });
        p && this.pieces[p.data.id].classList.add('highlight-capture');
      }.bind(this));
    },
    drawResetClassNames: function () {
      document.querySelectorAll('#game-chess .highlight-active').forEach(function (e) { e.classList.remove('highlight-active'); });
      document.querySelectorAll('#game-chess .highlight-capture').forEach(function (e) { e.classList.remove('highlight-capture'); });
      document.querySelectorAll('#game-chess .highlight-move').forEach(function (e) { e.classList.remove('highlight-move'); });
    },
    handleTileClick: function (location) {
      var result = this.game.activate(location);
      this.drawResetClassNames();
      var type = result.type;
      if (type === 'TOUCH') {
        var ep = result.captures.find(function (c) { return !!c.capture; });
        var pm = ep ? result.moves.concat([ep]) : result.moves;
        this.drawPiecePositions(pm, this.game.board.pieces[result.activePieceId].shape());
      } else this.drawPiecePositions();
      if (type === 'CANCEL' || type === 'INVALID') return;
      if (type === 'TOUCH') this.drawPositions(result.moves, result.captures);
      else if (type === 'CAPTURE') this.drawCapturedPiece(result.capturedPieceId);
      // crazy town
    },
    setPerspective: function (perspective) {
      var other = perspective === 'WHITE' ? 'perspective-black' : 'perspective-white';
      var current = perspective === 'WHITE' ? 'perspective-white' : 'perspective-black';
      this.element.classList.add(current);
      this.element.classList.remove(other);
    }
  };

  function Control(game, view) {
    this.inputSpeedAsap = document.getElementById('speed-asap');
    this.inputSpeedFast = document.getElementById('speed-fast');
    this.inputSpeedMedium = document.getElementById('speed-medium');
    this.inputSpeedSlow = document.getElementById('speed-slow');
    this.inputRandomBlack = document.getElementById('black-random');
    this.inputRandomWhite = document.getElementById('white-random');
    this.inputPerspectiveBlack = document.getElementById('black-perspective');
    this.inputPerspectiveWhite = document.getElementById('white-perspective');
    this.game = game;
    this.view = view;
    var self = this;
    this.inputPerspectiveBlack.addEventListener('change', function () { self.updateViewPerspective(); });
    this.inputPerspectiveWhite.addEventListener('change', function () { self.updateViewPerspective(); });
    this.updateViewPerspective();
  }
  Control.prototype = {
    get speed() {
      if (this.inputSpeedAsap.checked) return 50;
      if (this.inputSpeedFast.checked) return 250;
      if (this.inputSpeedMedium.checked) return 500;
      if (this.inputSpeedSlow.checked) return 1000;
      return 500;
    },
    autoplay: function () {
      var input = this.game.turn === 'WHITE' ? this.inputRandomWhite : this.inputRandomBlack;
      if (!input.checked) { setTimeout(this.autoplay.bind(this), this.speed); return; }
      var pos = this.game.randomMove();
      this.view.handleTileClick(pos);
      setTimeout(this.autoplay.bind(this), this.speed);
    },
    updateViewPerspective: function () {
      this.view.setPerspective(this.inputPerspectiveBlack.checked ? 'BLACK' : 'WHITE');
    }
  };

  // ─── BOOT ────────────────────────────────────────────────
  var game = new Game(getInitialPieces(), initialPositions, 'WHITE');
  var view = new View(document.getElementById('board'), game, 'WHITE');
  var control = new Control(game, view);
  control.autoplay();
})();
