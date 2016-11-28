/* global d3ospf */

// データマネージャモジュール
(function() {
  d3ospf.ospfData = function module() {
    // このモジュールは関数ではなくマップを返す
    var exports = {};

    // ローカルで実行する場合
    var prefix = 'static/site/img/';

    // Google Siteで実行する場合
    // var prefix = 'https://sites.google.com/site/d3ospfdemo/home/';

    var routerImage = prefix + 'r32.png';
    var transitImage = prefix + 't24.png';
    var stubImage = prefix + 'stub16.png';

    // プロトタイプ
    var proto_lsa = {
      ls_age: undefined,
      ls_type: undefined,
      ls_id: undefined,
      advRouter: undefined,
      numLinks: undefined, // ルータLSAの時にしか存在しない
      netmask: undefined, // ネットワークLSAの時にしか存在しない
      description: undefined

      // ルータLSAのときはこれを追加
      // lsa.connectedToP2ps =  [];
      // lsa.connectedToTransits = [];
      // lsa.connectedToStubs = [];

      // ネットワークLSAのときはこれを追加
      // attachedRouters = [];
    };

    function makeLsa() {
      var lsa = Object.create(proto_lsa);

      lsa.description = function() {
        var str = String() +
        'LS Age : ' + lsa.ls_age + '\n' +
        'LS Type : ' + lsa.ls_type + '\n' +
        'LS ID : ' + lsa.ls_id + '\n' +
        'Adv Router : ' + lsa.advRouter + '\n' +
        'Netmask : ' + lsa.netmask + '\n';
        return str;
      };

      return lsa;
    }

    // プロトタイプ
    var proto_connectedTo = {
      link_id: undefined,
      link_data: undefined
    };

    function makeConnectedTo() {
      return Object.create(proto_connectedTo);
    }

    /*
    * テキストをセクションに分割する。
    */
    function parseSection(lines) {
      // 引数を明示的に配列にする
      lines = [].concat(lines);

      // 2次元配列(名前を付けてわかりやすくした)
      var sections = [];
      var section = [];

      // 新しいセクションを検出したかどうか
      var isSection = false;

      var startStr = 'LS age:';
      var skipStr = '#';

      var i;
      var line;
      // セクションに分ける
      for (i = 0; i < lines.length; i++) {
        line = lines[i];

        // 途中でゴミが登場したら、それ以降はセクションとみなさない
        if (line.indexOf(skipStr) >= 0) {
          isSection = false;
          continue;
        }

        if (line.indexOf(startStr) >= 0) {
          // セクションの開始を検出
          isSection = true;
          if (section.length > 0) {
            // 一つ前のセクションを格納
            sections.push(section);
          }
          // 新しいセクションを作る
          section = [];
          section.push(line);
        } else if (isSection) {
          // セクション中なので行を格納していく
          section.push(line);
        }
      }
      // 一番最後のセクションを格納
      if (section.length > 0) {
        sections.push(section);
      }

      return sections;
    }

    function parseLsas(sections) {
      var lsas = [];

      // セクション単位でforを回す
      for (var i = 0; i < sections.length; i++) {
        var section = sections[i];
        var lsa = parseLsa(section);
        if (lsa !== null) {
          lsas.push(lsa);
        }
      }

      return lsas;
    }

    // 個々のセクションを受け取ってlsaに変換する
    function parseLsa(section) {
      // オブジェクトを作成
      var lsa = makeLsa();

      // ヘッダをセットする
      setLsaHeader(lsa, section);

      if (lsa.ls_type === 'Router Links') {
        setRouterLsa(lsa, section);
      } else if (lsa.ls_type === 'Network Links') {
        setNetworkLsa(lsa, section);
      } else {
        return null;
      }

      return lsa;
    }

    function setLsaHeader(lsa, section) {
      for (var i = 0; i < section.length; i++) {
        var line = section[i];
        var arr;

        arr = line.split('LS age: ');
        if (arr.length === 2) {
          lsa.ls_age = arr[1].trim();
          continue;
        }

        arr = line.split('LS Type: ');
        if (arr.length === 2) {
          lsa.ls_type = arr[1].trim();
          continue;
        }

        arr = line.split('Link State ID: ');
        if (arr.length === 2) {
          lsa.ls_id = arr[1].trim();
          continue;
        }

        arr = line.split('Advertising Router: ');
        if (arr.length === 2) {
          lsa.advRouter = arr[1].trim();
          continue;
        }

        arr = line.split('Network Mask: ');
        if (arr.length === 2) {
          lsa.netmask = arr[1].trim();
        }
      }
      //
    }

    function setRouterLsa(lsa, section) {
      // ルータLSAにはこれらを追加
      lsa.connectedToP2ps = [];
      lsa.connectedToTransits = [];
      lsa.connectedToStubs = [];

      var connectedTo;
      var arr = [];
      var i;
      for (i = 0; i < section.length; i++) {
        var line = section[i];

        // Link connected to: a Stub Network を見つけたら
        if (line.indexOf('Link connected to: a Stub Network') >= 0) {
          connectedTo = makeConnectedTo();
          setLinkData();
          lsa.connectedToStubs.push(connectedTo);
        }

        // Link connected to: a Transit Network を見つけたら
        if (line.indexOf('Link connected to: a Transit Network') >= 0) {
          connectedTo = makeConnectedTo();
          setLinkData();
          lsa.connectedToTransits.push(connectedTo);
        }

        // Link connected to: another Router (point-to-point) を見つけたら
        if (line.indexOf('Link connected to: another Router (point-to-point)') >= 0) {
          connectedTo = makeConnectedTo();
          setLinkData();
          lsa.connectedToP2ps.push(connectedTo);
        }
      }

      function setLinkData() {
        // 1行先を読む
        var j = ++i;
        if (j < section.length) {
          arr = section[j].split(':'); // :でスプリットした右側の部分
          if (arr.length === 2) {
            connectedTo.link_id = arr[1].trim();
          }
        }

        // さらに1行先を読む
        j = ++i;
        if (j < section.length) {
          arr = section[j].split(':'); // :でスプリットした右側の部分
          if (arr.length === 2) {
            connectedTo.link_data = arr[1].trim();
          }
        }
      }
      //
    }

    function setNetworkLsa(lsa, section) {
      // ネットワークLSAのときはこれを追加
      lsa.attachedRouters = [];

      var i;
      for (i = 0; i < section.length; i++) {
        var line = section[i];
        if (line.indexOf('Attached Router:') >= 0) {
          var arr = line.split(':');
          if (arr.length === 2) {
            lsa.attachedRouters.push(arr[1].trim());
          }
        }
      }
    }

    // ////////////////////////////////////////////

    // プロトタイプ
    var proto_node = {
      id: undefined,
      type: undefined, // router, network
      img: undefined,
      x: -16, // px
      y: -16, // px
      w: 32, // px
      h: 32, // px
      description: ''
    };

    function makeNode() {
      return Object.create(proto_node);
    }

    // プロトタイプ
    var proto_link = {
      source: undefined,
      target: undefined,
      type: undefined, // transit, stub, p2p
      strength: 0.5,
      description: ''
    };

    function makeLink() {
      return Object.create(proto_link);
    }

    function makeTopology(lsas) {
      var nodes = [];
      var links = [];

      var lsa;
      var i;
      var j;
      var lnk;

      // ルータLSAからD3用のノードを作成
      for (i = 0; i < lsas.length; i++) {
        lsa = lsas[i];

        if (lsa.ls_type === 'Router Links') {
          var rtr = makeNode();
          rtr.type = 'router';
          rtr.id = lsa.ls_id;
          rtr.img = routerImage;
          rtr.description = lsa.description;

          nodes.push(rtr);

          // スタブはノードとして作成する
          for (j = 0; j < lsa.connectedToStubs.length; j++) {
            var stb = makeNode();
            stb.type = 'stub';
            stb.id = lsa.connectedToStubs[j].link_id + '/' + lsa.connectedToStubs[j].link_data;
            stb.img = stubImage;
            stb.x = -8;
            stb.y = -8;
            stb.w = 16;
            stb.h = 16;
            stb.description = lsa.connectedToStubs[j].link_id + '/' + lsa.connectedToStubs[j].link_data;
            nodes.push(stb);

            // つながりの情報を作ったほうが良さそう
            lnk = makeLink();
            lnk.source = rtr;
            lnk.target = stb;
            lnk.type = 'stub';
            lnk.strength = 1.0;
            links.push(lnk);
          }
        }
      }

      // ルータLSAをすべて作成したら、ルータLSA同士の直結の線をつくる
      for (i = 0; i < lsas.length; i++) {
        lsa = lsas[i];

        if (lsa.ls_type === 'Router Links') {
          var n = getNodeById(nodes, lsa.ls_id);

          // p2pのリンクを作成する
          for (j = 0; j < lsa.connectedToP2ps.length; j++) {
            var n2 = getNodeById(nodes, lsa.connectedToP2ps[j].link_id);
            lnk = makeLink();
            lnk.source = n;
            lnk.target = n2;
            lnk.type = 'p2p';
            links.push(lnk);
          }
        }
      }

      // ネットワークLSAからD3用のノードを作成
      for (i = 0; i < lsas.length; i++) {
        lsa = lsas[i];

        if (lsa.ls_type === 'Network Links') {
          var net = makeNode();
          net.type = 'network';
          net.id = lsa.ls_id; // + lsa.netmask;
          net.img = transitImage;
          net.x = -12;
          net.y = -12;
          net.w = 24;
          net.h = 24;
          net.description = lsa.description;
          nodes.push(net);

          // attached routerとのつながりの情報を作ったほうが良さそう
          for (j = 0; j < lsa.attachedRouters.length; j++) {
            var attached = getNodeById(nodes, lsa.attachedRouters[j]);
            if (attached === null) {
              console.log('node not found : ' + lsa.attachedRouters[j]);
            } else {
              lnk = makeLink();
              lnk.source = attached;
              lnk.target = net;
              lnk.type = 'transit';
              links.push(lnk);
            }
          }
        }
      }

      return {
        nodes: nodes,
        links: links
      };
      //
    }

    function getNodeById(nodes, id) {
      var i;
      for (i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.id === id) {
          return n;
        }
      }
      return null;
    }

    var SAMPLE_LINES = [
      'User Access Verification',
      '',
      'Username: cisco',
      'Password: ',
      'c2811>172.18.0.101',
      'Trying 172.18.0.101 ... Open',
      '',
      '',
      'User Access Verification',
      '',
      'Password: ',
      'R1>en',
      'Password: ',
      'R1#sh ip os da',
      'R1#sh ip os database ro',
      'R1#sh ip os database router ',
      '',
      '            OSPF Router with ID (1.1.1.1) (Process ID 1)',
      '',
      '                Router Link States (Area 0)',
      '',
      '  LS age: 737',
      '  Options: (No TOS-capability, DC)',
      '  LS Type: Router Links',
      '  Link State ID: 1.1.1.1',
      '  Advertising Router: 1.1.1.1',
      '  LS Seq Number: 800000AE',
      '  Checksum: 0xD1B0',
      '  Length: 60',
      '  AS Boundary Router',
      '  Number of Links: 3',
      '',
      '    Link connected to: a Stub Network',
      '     (Link ID) Network/subnet number: 10.244.254.1',
      '     (Link Data) Network Mask: 255.255.255.255',
      '      Number of MTID metrics: 0',
      '       TOS 0 Metrics: 1',
      '',
      '    Link connected to: a Transit Network',
      '     (Link ID) Designated Router address: 10.245.11.2',
      '     (Link Data) Router Interface address: 10.245.11.1',
      '      Number of MTID metrics: 0',
      '       TOS 0 Metrics: 1',
      '',
      '    Link connected to: a Stub Network',
      '     (Link ID) Network/subnet number: 172.18.0.0',
      '     (Link Data) Network Mask: 255.255.0.0',
      '      Number of MTID metrics: 0',
      '       TOS 0 Metrics: 1',
      '',
      '',
      '  LS age: 826',
      '  Options: (No TOS-capability, DC)',
      '  LS Type: Router Links',
      '  Link State ID: 1.1.1.2',
      '  Advertising Router: 1.1.1.2',
      '  LS Seq Number: 800000AB',
      '  Checksum: 0x6AF4',
      '  Length: 72',
      '  AS Boundary Router',
      '  Number of Links: 4',
      '',
      '    Link connected to: a Stub Network',
      '     (Link ID) Network/subnet number: 10.244.254.2',
      '     (Link Data) Network Mask: 255.255.255.255',
      '      Number of MTID metrics: 0',
      '       TOS 0 Metrics: 1',
      '',
      '    Link connected to: a Transit Network',
      '     (Link ID) Designated Router address: 10.245.8.1',
      '     (Link Data) Router Interface address: 10.245.8.1',
      '      Number of MTID metrics: 0',
      '       TOS 0 Metrics: 1',
      '',
      '    Link connected to: a Transit Network',
      '     (Link ID) Designated Router address: 10.245.11.2',
      '     (Link Data) Router Interface address: 10.245.11.2',
      '      Number of MTID metrics: 0',
      '       TOS 0 Metrics: 1',
      '',
      '    Link connected to: a Stub Network',
      '     (Link ID) Network/subnet number: 172.18.0.0',
      '     (Link Data) Network Mask: 255.255.0.0',
      '      Number of MTID metrics: 0',
      '       TOS 0 Metrics: 1',
      '',
      '',
      '  LS age: 792',
      '  Options: (No TOS-capability, DC)',
      '  LS Type: Router Links',
      '  Link State ID: 1.1.1.3',
      '  Advertising Router: 1.1.1.3',
      '  LS Seq Number: 800000B9',
      '  Checksum: 0xD682',
      '  Length: 36',
      '  AS Boundary Router',
      '  Number of Links: 1',
      '',
      '    Link connected to: a Transit Network',
      '     (Link ID) Designated Router address: 10.245.8.1',
      '     (Link Data) Router Interface address: 10.245.8.2',
      '      Number of MTID metrics: 0',
      '       TOS 0 Metrics: 1',
      '',
      '          ',
      'R1#show ip da',
      'R1#show ip os da',
      'R1#show ip os database net',
      'R1#show ip os database network ',
      '',
      '            OSPF Router with ID (1.1.1.1) (Process ID 1)',
      '',
      '                Net Link States (Area 0)',
      '',
      '  LS age: 835',
      '  Options: (No TOS-capability, DC)',
      '  LS Type: Network Links',
      '  Link State ID: 10.245.8.1 (address of Designated Router)',
      '  Advertising Router: 1.1.1.2',
      '  LS Seq Number: 80000015',
      '  Checksum: 0x61AB',
      '  Length: 32',
      '  Network Mask: /24',
      '        Attached Router: 1.1.1.2',
      '        Attached Router: 1.1.1.3',
      '',
      '  LS age: 1076',
      '  Options: (No TOS-capability, DC)',
      '  LS Type: Network Links',
      '  Link State ID: 10.245.11.2 (address of Designated Router)',
      '  Advertising Router: 1.1.1.2',
      '  LS Seq Number: 80000039',
      '  Checksum: 0xD115',
      '  Length: 32',
      '  Network Mask: /24',
      '        Attached Router: 1.1.1.2',
      '        Attached Router: 1.1.1.1',
      '',
      'R1#'
    ];

    // 外部からデータを取得するための公開関数
    exports.sampleLines = function(_) {
      if (!arguments.length) {
        return SAMPLE_LINES;
      }
      SAMPLE_LINES = _;
      return this;
    };

    exports.sampleText = function(_) {
      if (!arguments.length) {
        return SAMPLE_LINES.join('\n');
      }
      SAMPLE_LINES = _.split(/\r\n|\r|\n/);
      return this;
    };

    exports.getTopologyFromText = function(text) {
      var lines = String(text).split(/\r\n|\r|\n/);
      return exports.getTopologyFromLines(lines);
    };

    exports.getTopologyFromLines = function(lines) {
      // パースして意味のあるsectionに分割して配列に格納する
      var sections = parseSection(lines);

      // 文字列情報からlsaオブジェクトの配列にする
      var lsas = parseLsas(sections);

      // lsaオブジェクトの配列から、d3.jsで描画するためのトポロジを生成する
      var topology = makeTopology(lsas);

      return topology;
    };

    return exports;
  };
  //
})();
