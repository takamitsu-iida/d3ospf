/* global d3, d3ospf */

// グローバルに独自の名前空間を定義する
(function() {
  // このthisはグローバル空間
  this.d3ospf = this.d3ospf || (function() {
    // アプリのデータを取り込む場合、appdata配下にぶら下げる
    var appdata = {};

    // ヒアドキュメント経由で静的データを取り込む場合、テキストデータをheredoc配下にぶら下げる
    var heredoc = {};

    // 地図データを取り込む場合、geodata配下にぶら下げる
    var geodata = {};

    // 公開するオブジェクト
    return {
      appdata: appdata,
      heredoc: heredoc,
      geodata: geodata
    };
  })();
  //
})();

// メイン関数
(function() {
  d3ospf.main = function() {
    var dm = d3ospf.ospfData();

    d3.select('textarea').property('value', function() {
      return dm.sampleText();
    });

    // mapChartをインスタンス化する
    var chart = d3ospf.ospfChart();

    // コンテナへのセレクタ
    var container = d3.select('#ospf-body');

    d3.select('button').on('click', function() {
      var text = d3.select('textarea').property('value');
      var topology = dm.getTopologyFromText(text);

      // コンテナにデータを紐付けてcall()する
      container.datum(topology).call(chart);
    });

    //
  };
  //
})();
