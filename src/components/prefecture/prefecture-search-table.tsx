"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PREFECTURES = [
  {
    name: "北海道",
    hiragana: "ほっかいどう",
    capital: "札幌市",
    capitalHiragana: "さっぽろし",
    region: "北海道",
  },
  {
    name: "青森県",
    hiragana: "あおもりけん",
    capital: "青森市",
    capitalHiragana: "あおもりし",
    region: "東北",
  },
  {
    name: "岩手県",
    hiragana: "いわてけん",
    capital: "盛岡市",
    capitalHiragana: "もりおかし",
    region: "東北",
  },
  {
    name: "宮城県",
    hiragana: "みやぎけん",
    capital: "仙台市",
    capitalHiragana: "せんだいし",
    region: "東北",
  },
  {
    name: "秋田県",
    hiragana: "あきたけん",
    capital: "秋田市",
    capitalHiragana: "あきたし",
    region: "東北",
  },
  {
    name: "山形県",
    hiragana: "やまがたけん",
    capital: "山形市",
    capitalHiragana: "やまがたし",
    region: "東北",
  },
  {
    name: "福島県",
    hiragana: "ふくしまけん",
    capital: "福島市",
    capitalHiragana: "ふくしまし",
    region: "東北",
  },
  {
    name: "茨城県",
    hiragana: "いばらきけん",
    capital: "水戸市",
    capitalHiragana: "みとし",
    region: "関東",
  },
  {
    name: "栃木県",
    hiragana: "とちぎけん",
    capital: "宇都宮市",
    capitalHiragana: "うつのみやし",
    region: "関東",
  },
  {
    name: "群馬県",
    hiragana: "ぐんまけん",
    capital: "前橋市",
    capitalHiragana: "まえばしし",
    region: "関東",
  },
  {
    name: "埼玉県",
    hiragana: "さいたまけん",
    capital: "さいたま市",
    capitalHiragana: "さいたまし",
    region: "関東",
  },
  {
    name: "千葉県",
    hiragana: "ちばけん",
    capital: "千葉市",
    capitalHiragana: "ちばし",
    region: "関東",
  },
  {
    name: "東京都",
    hiragana: "とうきょうと",
    capital: "東京",
    capitalHiragana: "とうきょう",
    region: "関東",
  },
  {
    name: "神奈川県",
    hiragana: "かながわけん",
    capital: "横浜市",
    capitalHiragana: "よこはまし",
    region: "関東",
  },
  {
    name: "新潟県",
    hiragana: "にいがたけん",
    capital: "新潟市",
    capitalHiragana: "にいがたし",
    region: "中部",
  },
  {
    name: "富山県",
    hiragana: "とやまけん",
    capital: "富山市",
    capitalHiragana: "とやまし",
    region: "中部",
  },
  {
    name: "石川県",
    hiragana: "いしかわけん",
    capital: "金沢市",
    capitalHiragana: "かなざわし",
    region: "中部",
  },
  {
    name: "福井県",
    hiragana: "ふくいけん",
    capital: "福井市",
    capitalHiragana: "ふくいし",
    region: "中部",
  },
  {
    name: "山梨県",
    hiragana: "やまなしけん",
    capital: "甲府市",
    capitalHiragana: "こうふし",
    region: "中部",
  },
  {
    name: "長野県",
    hiragana: "ながのけん",
    capital: "長野市",
    capitalHiragana: "ながのし",
    region: "中部",
  },
  {
    name: "岐阜県",
    hiragana: "ぎふけん",
    capital: "岐阜市",
    capitalHiragana: "ぎふし",
    region: "中部",
  },
  {
    name: "静岡県",
    hiragana: "しずおかけん",
    capital: "静岡市",
    capitalHiragana: "しずおかし",
    region: "中部",
  },
  {
    name: "愛知県",
    hiragana: "あいちけん",
    capital: "名古屋市",
    capitalHiragana: "なごやし",
    region: "中部",
  },
  {
    name: "三重県",
    hiragana: "みえけん",
    capital: "津市",
    capitalHiragana: "つし",
    region: "近畿",
  },
  {
    name: "滋賀県",
    hiragana: "しがけん",
    capital: "大津市",
    capitalHiragana: "おおつし",
    region: "近畿",
  },
  {
    name: "京都府",
    hiragana: "きょうとふ",
    capital: "京都市",
    capitalHiragana: "きょうとし",
    region: "近畿",
  },
  {
    name: "大阪府",
    hiragana: "おおさかふ",
    capital: "大阪市",
    capitalHiragana: "おおさかし",
    region: "近畿",
  },
  {
    name: "兵庫県",
    hiragana: "ひょうごけん",
    capital: "神戸市",
    capitalHiragana: "こうべし",
    region: "近畿",
  },
  {
    name: "奈良県",
    hiragana: "ならけん",
    capital: "奈良市",
    capitalHiragana: "ならし",
    region: "近畿",
  },
  {
    name: "和歌山県",
    hiragana: "わかやまけん",
    capital: "和歌山市",
    capitalHiragana: "わかやまし",
    region: "近畿",
  },
  {
    name: "鳥取県",
    hiragana: "とっとりけん",
    capital: "鳥取市",
    capitalHiragana: "とっとりし",
    region: "中国",
  },
  {
    name: "島根県",
    hiragana: "しまねけん",
    capital: "松江市",
    capitalHiragana: "まつえし",
    region: "中国",
  },
  {
    name: "岡山県",
    hiragana: "おかやまけん",
    capital: "岡山市",
    capitalHiragana: "おかやまし",
    region: "中国",
  },
  {
    name: "広島県",
    hiragana: "ひろしまけん",
    capital: "広島市",
    capitalHiragana: "ひろしまし",
    region: "中国",
  },
  {
    name: "山口県",
    hiragana: "やまぐちけん",
    capital: "山口市",
    capitalHiragana: "やまぐちし",
    region: "中国",
  },
  {
    name: "徳島県",
    hiragana: "とくしまけん",
    capital: "徳島市",
    capitalHiragana: "とくしまし",
    region: "四国",
  },
  {
    name: "香川県",
    hiragana: "かがわけん",
    capital: "高松市",
    capitalHiragana: "たかまつし",
    region: "四国",
  },
  {
    name: "愛媛県",
    hiragana: "えひめけん",
    capital: "松山市",
    capitalHiragana: "まつやまし",
    region: "四国",
  },
  {
    name: "高知県",
    hiragana: "こうちけん",
    capital: "高知市",
    capitalHiragana: "こうちし",
    region: "四国",
  },
  {
    name: "福岡県",
    hiragana: "ふくおかけん",
    capital: "福岡市",
    capitalHiragana: "ふくおかし",
    region: "九州",
  },
  {
    name: "佐賀県",
    hiragana: "さがけん",
    capital: "佐賀市",
    capitalHiragana: "さがし",
    region: "九州",
  },
  {
    name: "長崎県",
    hiragana: "ながさきけん",
    capital: "長崎市",
    capitalHiragana: "ながさきし",
    region: "九州",
  },
  {
    name: "熊本県",
    hiragana: "くまもとけん",
    capital: "熊本市",
    capitalHiragana: "くまもとし",
    region: "九州",
  },
  {
    name: "大分県",
    hiragana: "おおいたけん",
    capital: "大分市",
    capitalHiragana: "おおいたし",
    region: "九州",
  },
  {
    name: "宮崎県",
    hiragana: "みやざきけん",
    capital: "宮崎市",
    capitalHiragana: "みやざきし",
    region: "九州",
  },
  {
    name: "鹿児島県",
    hiragana: "かごしまけん",
    capital: "鹿児島市",
    capitalHiragana: "かごしまし",
    region: "九州",
  },
  {
    name: "沖縄県",
    hiragana: "おきなわけん",
    capital: "那覇市",
    capitalHiragana: "なはし",
    region: "九州",
  },
];

export function PrefectureSearchTableComponent() {
  const [prefectureSearch, setPrefectureSearch] = useState("");
  const [capitalSearch, setCapitalSearch] = useState("");
  const [filteredPrefectures, setFilteredPrefectures] = useState(PREFECTURES);

  useEffect(() => {
    const filtered = PREFECTURES.filter((prefecture) => {
      const prefectureMatch = matchSearch(
        prefecture.hiragana,
        prefectureSearch
      );
      const capitalMatch = matchSearch(
        prefecture.capitalHiragana,
        capitalSearch
      );
      return prefectureMatch && capitalMatch;
    });
    setFilteredPrefectures(filtered);
  }, [prefectureSearch, capitalSearch]);

  // 検索マッチング関数を修正
  const matchSearch = (text: string, search: string) => {
    if (!search) return true;

    try {
      // 全角記号を半角に変換
      const normalizedSearch = search
        .replace(/[＊]/g, "*")
        .replace(/[？]/g, "?");

      // ワイルドカード文字を正規表現パターンに変換
      const pattern = normalizedSearch.replace(/\*/g, ".*").replace(/\?/g, ".");

      const regex = new RegExp(`${pattern}`, "i");
      return regex.test(text);
    } catch (error) {
      return false;
    }
  };

  const handlePrefectureSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setPrefectureSearch(input);
  };

  const handleCapitalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setCapitalSearch(input);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-[700px] mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          都道府県検索システム
        </h1>
        <div className="flex gap-4 mb-2">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="都道府県をひらがな検索"
              value={prefectureSearch}
              onChange={handlePrefectureSearch}
              className="bg-gray-700 text-white placeholder-gray-400 border-purple-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              ※＊（0文字以上）？（1文字）も利用して検索可
            </p>
          </div>
          <div className="flex-1">
            <Input
              type="text"
              placeholder="県庁所在地をひらがな検索"
              value={capitalSearch}
              onChange={handleCapitalSearch}
              className="bg-gray-700 text-white placeholder-gray-400 border-purple-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              ※＊（0文字以上）、？（1文字）も利用して検索可
            </p>
          </div>
        </div>
        <div className="overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-purple-400">地方</TableHead>
                <TableHead className="text-purple-400">都道府県</TableHead>
                <TableHead className="text-purple-400">ひらがな</TableHead>
                <TableHead className="text-purple-400">県庁所在地</TableHead>
                <TableHead className="text-purple-400">ひらがな</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrefectures.map((prefecture) => (
                <TableRow key={prefecture.name} className="hover:bg-gray-700">
                  <TableCell>{prefecture.region}</TableCell>
                  <TableCell>{prefecture.name}</TableCell>
                  <TableCell>{prefecture.hiragana}</TableCell>
                  <TableCell>{prefecture.capital}</TableCell>
                  <TableCell>{prefecture.capitalHiragana}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
