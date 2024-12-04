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
    capital: "札幌",
    capitalHiragana: "さっぽろ",
    region: "北海道",
  },
  {
    name: "青森",
    hiragana: "あおもり",
    capital: "青森",
    capitalHiragana: "あおもり",
    region: "東北",
  },
  {
    name: "岩手",
    hiragana: "いわて",
    capital: "盛岡",
    capitalHiragana: "もりおか",
    region: "東北",
  },
  {
    name: "宮城",
    hiragana: "みやぎ",
    capital: "仙台",
    capitalHiragana: "せんだい",
    region: "東北",
  },
  {
    name: "秋田",
    hiragana: "あきた",
    capital: "秋田",
    capitalHiragana: "あきた",
    region: "東北",
  },
  {
    name: "山形",
    hiragana: "やまがた",
    capital: "山形",
    capitalHiragana: "やまがた",
    region: "東北",
  },
  {
    name: "福島",
    hiragana: "ふくしま",
    capital: "福島",
    capitalHiragana: "ふくしま",
    region: "東北",
  },
  {
    name: "茨城",
    hiragana: "いばらき",
    capital: "水戸",
    capitalHiragana: "みと",
    region: "関東",
  },
  {
    name: "栃木",
    hiragana: "とちぎ",
    capital: "宇都宮",
    capitalHiragana: "うつのみや",
    region: "関東",
  },
  {
    name: "群馬",
    hiragana: "ぐんま",
    capital: "前橋",
    capitalHiragana: "まえばし",
    region: "関東",
  },
  {
    name: "埼玉",
    hiragana: "さいたま",
    capital: "さいたま",
    capitalHiragana: "さいたま",
    region: "関東",
  },
  {
    name: "千葉",
    hiragana: "ちば",
    capital: "千葉",
    capitalHiragana: "ちば",
    region: "関東",
  },
  {
    name: "東京",
    hiragana: "とうきょう",
    capital: "東京",
    capitalHiragana: "とうきょう",
    region: "関東",
  },
  {
    name: "神奈川",
    hiragana: "かながわ",
    capital: "横浜",
    capitalHiragana: "よこはま",
    region: "関東",
  },
  {
    name: "新潟",
    hiragana: "にいがた",
    capital: "新潟",
    capitalHiragana: "にいがた",
    region: "中部",
  },
  {
    name: "富山",
    hiragana: "とやま",
    capital: "富山",
    capitalHiragana: "とやま",
    region: "中部",
  },
  {
    name: "石川",
    hiragana: "いしかわ",
    capital: "金沢",
    capitalHiragana: "かなざわ",
    region: "中部",
  },
  {
    name: "福井",
    hiragana: "ふくい",
    capital: "福井",
    capitalHiragana: "ふくい",
    region: "中部",
  },
  {
    name: "山梨",
    hiragana: "やまなし",
    capital: "甲府",
    capitalHiragana: "こうふ",
    region: "中部",
  },
  {
    name: "長野",
    hiragana: "ながの",
    capital: "長野",
    capitalHiragana: "ながの",
    region: "中部",
  },
  {
    name: "岐阜",
    hiragana: "ぎふ",
    capital: "岐阜",
    capitalHiragana: "ぎふ",
    region: "中部",
  },
  {
    name: "静岡",
    hiragana: "しずおか",
    capital: "静岡",
    capitalHiragana: "しずおか",
    region: "中部",
  },
  {
    name: "愛知",
    hiragana: "あいち",
    capital: "名古屋",
    capitalHiragana: "なごや",
    region: "中部",
  },
  {
    name: "三重",
    hiragana: "みえ",
    capital: "津",
    capitalHiragana: "つ",
    region: "近畿",
  },
  {
    name: "滋賀",
    hiragana: "しが",
    capital: "大津",
    capitalHiragana: "おおつ",
    region: "近畿",
  },
  {
    name: "京都",
    hiragana: "きょうと",
    capital: "京都",
    capitalHiragana: "きょうと",
    region: "近畿",
  },
  {
    name: "大阪",
    hiragana: "おおさか",
    capital: "大阪",
    capitalHiragana: "おおさか",
    region: "近畿",
  },
  {
    name: "兵庫",
    hiragana: "ひょうご",
    capital: "神戸",
    capitalHiragana: "こうべ",
    region: "近畿",
  },
  {
    name: "奈良",
    hiragana: "なら",
    capital: "奈良",
    capitalHiragana: "なら",
    region: "近畿",
  },
  {
    name: "和歌山",
    hiragana: "わかやま",
    capital: "和歌山",
    capitalHiragana: "わかやま",
    region: "近畿",
  },
  {
    name: "鳥取",
    hiragana: "とっとり",
    capital: "鳥取",
    capitalHiragana: "とっとり",
    region: "中国",
  },
  {
    name: "島根",
    hiragana: "しまね",
    capital: "松江",
    capitalHiragana: "まつえ",
    region: "中国",
  },
  {
    name: "岡山",
    hiragana: "おかやま",
    capital: "岡山",
    capitalHiragana: "おかやま",
    region: "中国",
  },
  {
    name: "広島",
    hiragana: "ひろしま",
    capital: "広島",
    capitalHiragana: "ひろしま",
    region: "中国",
  },
  {
    name: "山口",
    hiragana: "やまぐち",
    capital: "山口",
    capitalHiragana: "やまぐち",
    region: "中国",
  },
  {
    name: "徳島",
    hiragana: "とくしま",
    capital: "徳島",
    capitalHiragana: "とくしま",
    region: "四国",
  },
  {
    name: "香川",
    hiragana: "かがわ",
    capital: "高松",
    capitalHiragana: "たかまつ",
    region: "四国",
  },
  {
    name: "愛媛",
    hiragana: "えひめ",
    capital: "松山",
    capitalHiragana: "まつやま",
    region: "四国",
  },
  {
    name: "高知",
    hiragana: "こうち",
    capital: "高知",
    capitalHiragana: "こうち",
    region: "四国",
  },
  {
    name: "福岡",
    hiragana: "ふくおか",
    capital: "福岡",
    capitalHiragana: "ふくおか",
    region: "九州",
  },
  {
    name: "佐賀",
    hiragana: "さが",
    capital: "佐賀",
    capitalHiragana: "さが",
    region: "九州",
  },
  {
    name: "長崎",
    hiragana: "ながさき",
    capital: "長崎",
    capitalHiragana: "ながさき",
    region: "九州",
  },
  {
    name: "熊本",
    hiragana: "くまもと",
    capital: "熊本",
    capitalHiragana: "くまもと",
    region: "九州",
  },
  {
    name: "大分",
    hiragana: "おおいた",
    capital: "大分",
    capitalHiragana: "おおいた",
    region: "九州",
  },
  {
    name: "宮崎",
    hiragana: "みやざき",
    capital: "宮崎",
    capitalHiragana: "みやざき",
    region: "九州",
  },
  {
    name: "鹿児島",
    hiragana: "かごしま",
    capital: "鹿児島",
    capitalHiragana: "かごしま",
    region: "九州",
  },
  {
    name: "沖縄",
    hiragana: "おきなわ",
    capital: "那覇",
    capitalHiragana: "なは",
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

      const regex = new RegExp(`^${pattern}$`, "i");
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
    <main className="p-8">
      <div className="max-w-[700px] mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          都道府県システム
        </h1>
        <div className="flex gap-4 mb-2">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="都道府県ひらがな"
              value={prefectureSearch}
              onChange={handlePrefectureSearch}
              className="bg-gray-700 text-white placeholder-gray-400 border-purple-400 text-base"
            />
          </div>
          <div className="flex-1">
            <Input
              type="text"
              placeholder="県庁所在地ひらがな"
              value={capitalSearch}
              onChange={handleCapitalSearch}
              className="bg-gray-700 text-white placeholder-gray-400 border-purple-400"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1 text-center">
          ※ アスタリスク(＊)で0文字以上、クエスチョン(？)1文字
        </p>
        <div className="overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell text-purple-400">
                  地方
                </TableHead>
                <TableHead className="text-purple-400">都道府県</TableHead>
                <TableHead className="hidden sm:table-cell text-purple-400">
                  ひらがな
                </TableHead>
                <TableHead className="text-purple-400">県庁所在地</TableHead>
                <TableHead className="hidden sm:table-cell text-purple-400">
                  ひらがな
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrefectures.map((prefecture) => (
                <TableRow key={prefecture.name} className="hover:bg-gray-700">
                  <TableCell className="hidden sm:table-cell">
                    {prefecture.region}
                  </TableCell>
                  <TableCell>{prefecture.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {prefecture.hiragana}
                  </TableCell>
                  <TableCell>{prefecture.capital}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {prefecture.capitalHiragana}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
