/* global d3, d3ospf */

(function() {
  d3ospf.ospfChart = function module(_accessor) {
    // コンテナの幅に合わせるかどうか
    var adjustContainerWidth = false;

    // 枠の大きさ
    var width = 800;
    var height = 400;

    // 'g'の描画領域となるデフォルトのマージン
    var margin = {
      top: 70,
      right: 20,
      bottom: 20,
      left: 20
    };

    // チャート描画領域のサイズw, h
    // 軸や凡例がはみ出てしまうので、マージンの分だけ小さくしておく。
    var w = width - margin.left - margin.right;
    var h = height - margin.top - margin.bottom;

    // svgへのセレクタ
    var svg;

    // 描画領域へのセレクタ
    var baseLayer;
    var linkLayer;
    var nodeLayer;

    // ツールチップのセレクタ
    var tooltip;

    //
    var displaySelectItems = ['stub', 'fixed'];
    var displaySelectMap = {};

    // ノードとリンクへのセレクタ
    var node;
    var link;

    // forceSimulationインスタンス
    var simulation;

    // ノードドラッグ動作
    var drag = d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);

    // call()したセレクタ
    var container;

    // call()時に渡されるデータ
    var topology;

    // call()されたときに呼ばれる公開関数
    function exports(_selection) {
      if (adjustContainerWidth) {
        var containerWidth = _selection.node().clientWidth;
        exports.width(containerWidth);
      }
      container = _selection;
      _selection.each(function(_data) {
        if (!_data) {
          // データにnullを指定してcall()した場合は、既存の描画領域を削除して終了
          container.selectAll('div').remove();
          container.select('svg').remove();
          return;
        }

        // ツールチップ用のHTMLを追加する
        var tooltipAll = container.selectAll('#ospf-tooltip').data(['dummy']);
        tooltip = tooltipAll
          .enter()
          .append('span')
          .attr('id', 'ospf-tooltip')
          .merge(tooltipAll);

        // 渡されるデータはオブジェクト
        topology = _data;
        // console.log(topology);

        // コンテナの大きさを取り出す
        var containerWidth = container.node().clientWidth;
        var containerHeight = container.node().clientHeight;

        // svgの大きさはそれに合わせる(スクロールバーの分を適当に引く)
        exports.width(containerWidth);
        exports.height(containerHeight);

        initDisplaySelector();

        // svgを作成する
        var svgAll = container.selectAll('svg').data(['dummy']);
        svg = svgAll
          .enter()
          .append('svg')
          .merge(svgAll)
          .attr('width', width)
          .attr('height', height);

        // svgの上にチャート描画領域'g'を追加
        var baseLayerAll = svg.selectAll('.ospf-base-layer').data(['dummy']);
        baseLayer = baseLayerAll
          // ENTER領域
          .enter()
          .append('g')
          .classed('ospf-base-layer', true)
          // ENTER + UPDATE領域
          .merge(baseLayerAll)
          .attr('width', w)
          .attr('height', h)
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        var linkLayerAll = baseLayer.selectAll('.ospf-link-layer').data(['dummy']);
        linkLayer = linkLayerAll
          .enter()
          .append('g')
          .classed('ospf-link-layer', true)
          .merge(linkLayerAll);

        var nodeLayerAll = baseLayer.selectAll('.ospf-node-layer').data(['dummy']);
        nodeLayer = nodeLayerAll
          .enter()
          .append('g')
          .classed('ospf-node-layer', true)
          .merge(nodeLayerAll);

        // レイアウトを設定
        initForce();

        // 描画
        drawChart(topology);

        // 初期状態
        setNodeFixed(true);
      });
    }

    function initForce() {
      // レイアウト設定
      var forceLink = d3.forceLink();
      forceLink
        .id(function(d) {
          return d.index;
        })
        .distance(0)
        .strength(0.1);

      simulation = d3.forceSimulation()
        .force('link', forceLink)
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter(w / 2, h / 3));
    }

    function drawChart(topology) {
      // 線を描画する
      // 線の色や太さはCSSで指定する
      var linkAll = linkLayer.selectAll('.ospf-link').data(topology.links, function(d) {
        return d.index;
      });

      link = linkAll
        .enter()
        .append('line')
        .attr('class', function(d) {
          return 'ospf-link ' + d.type;
        })
        .merge(linkAll);

      linkAll
        .exit()
        .remove();

      var nodeAll = nodeLayer.selectAll('.ospf-node-g').data(topology.nodes, function(d) {
        return d.index;
      });

      nodeAll
        .exit()
        .remove();

      node = nodeAll
        .enter()
        .append('g')
        .attr('class', 'ospf-node-g')
        .call(drag);

      node
        .append('image')
        .attr('class', function(d) {
          return 'ospf-node ' + d.type;
        })
        .attr('xlink:href', function(d) {
          return d.img;
        })
        .attr('width', function(d) {
          return d.w + 'px';
        })
        .attr('height', function(d) {
          return d.h + 'px';
        })
        .attr('x', function(d) {
          return -1 * d.w / 2;
        })
        .attr('y', function(d) {
          return -1 * d.h / 2;
        })
        .on('mouseover', function(d) {
          tooltip.style('visibility', 'visible').text(d.description);
        })
        .on('mouseout', function(d) {
          tooltip.style('visibility', 'hidden');
        });
        /*
        .on('dblclick', function(d) {
          d.fixed = !d.fixed;
        });
        */

      node
        .append('text')
        .attr('class', function(d) {
          return 'ospf-nodetext ' + d.type;
        })
        .attr('dx', 24)
        .attr('dy', '.35em')
        .text(function(d) {
          return d.id;
        });

      node = node.merge(nodeAll);

      simulation
        .nodes(topology.nodes)
        .on('tick', ticked);

      simulation
        .force('link')
        .links(topology.links);
    }

    function ticked() {
      link
        .attr('x1', function(d) {
          return d.source.x;
        })
        .attr('y1', function(d) {
          return d.source.y;
        })
        .attr('x2', function(d) {
          return d.target.x;
        })
        .attr('y2', function(d) {
          return d.target.y;
        });

      node
        .attr('transform', function(d) {
          return 'translate(' + d.x + ',' + d.y + ')';
        });
    }

    function dragstarted(d) {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active) simulation.alphaTarget(0);
      if (!d.fixed) {
        d.fx = null;
        d.fy = null;
      }
    }

    function setStubVisible(v) {
      linkLayer.selectAll('.ospf-link.stub').style('visibility', function(d) {
        return v ? 'visible' : 'hidden';
      });

      nodeLayer.selectAll('.ospf-node.stub').style('visibility', function(d) {
        return v ? 'visible' : 'hidden';
      });

      nodeLayer.selectAll('.ospf-nodetext.stub').style('visibility', function(d) {
        return v ? 'visible' : 'hidden';
      });
    }

    function setNodeFixed(v) {
      nodeLayer
        .selectAll('.ospf-node')
        .each(function(d) {
          d.fixed = v;
        });

      if (v) {
        while (simulation.alpha() > simulation.alphaMin()) {
          simulation.tick();
        }
        nodeLayer
          .selectAll('.ospf-node')
          .each(function(d) {
            d.fx = d.x;
            d.fy = d.y;
          });
      } else {
        nodeLayer
          .selectAll('.ospf-node')
          .each(function(d) {
            d.fx = null;
            d.fy = null;
          });
      }
    }

    // チェックボックスモジュールをインスタンス化する
    var cb = d3ospf.checkbox().on('click', cbOnClick);

    function cbOnClick(d) {
      // onoffmapが返ってくる
      if (displaySelectMap.fixed !== d.fixed) {
        setNodeFixed(d.fixed);
        displaySelectMap.fixed = d.fixed;
      }
      if (displaySelectMap.stub !== d.stub) {
        setStubVisible(d.stub);
        displaySelectMap.stub = d.stub;
      }
    }

    function initDisplaySelector() {
      for (var i = 0; i < displaySelectItems.length; i++) {
        displaySelectMap[displaySelectItems[i]] = true;
      }

      var displaySelectorAll = container.selectAll('.ospf-display-selector').data(['dummy']);
      var displaySelector = displaySelectorAll
        .enter()
        .append('div')
        .classed('ospf-display-selector', true)
        .merge(displaySelectorAll);

      // コンテナにデバイス名の配列を指定してcall()する
      displaySelector.datum(displaySelectItems).call(cb);
    }

    // /////////////////////////

    exports.width = function(_) {
      if (!arguments.length) {
        return width;
      }
      width = _;
      w = width - margin.left - margin.right;
      return this;
    };

    exports.height = function(_) {
      if (!arguments.length) {
        return height;
      }
      height = _;
      h = height - margin.top - margin.bottom;
      return this;
    };

    return exports;
  };

  //
})();
