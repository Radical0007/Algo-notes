# CF2209C Find the Zero

## 题目链接：[Problem - C - Codeforces](https://codeforces.com/contest/2209/problem/C)



## 题意

### 这是一道**交互题**。

给定一个整数 n。存在一个长度为 2n 的隐藏数组 a。其中 1 到 n 每个整数恰好出现一次，其余元素均为 0。

你可以进行如下形式的查询：

- 选择两个整数 i 和 j（1≤i,j≤2n,i=j）。评测机将返回 1 若 ai=aj，否则返回 0。

在不超过 n+1 次查询内，找出任意一个满足 ak=0 的整数 k（1≤k≤2n）。注意：交互器是**自适应**的，这意味着隐藏数组 a 可能会根据你的查询而变化，但不会与之前的查询结果矛盾。



## 思路

还是比较难想到的，构造题整体偏难。设非0数为x，用n-1次操作把2*n-4个数两两查验。如果有返回1的说明是两个0，择一输出即可。如果没有，那么最后四个数只有两个0和两个x组合，四个数选择一个对其中任意两个查验，如果两个都返回0，说明查验的组合是（0，x）（0，x），那么剩下的那个肯定是0。如果其中有组合返回1了，那么择一输出。



## 代码

```
#include <bits/stdc++.h>
#define int long long
//#define endl "\n"
using namespace std;



void solve(){
	int n;
	cin>>n;
	for(int i=1;i<=2*n-3;i+=2){
		cout<<"? "<<i<<' '<<i+1<<endl;
		int res;
		cin>>res;
		if(res==1){
			cout<<"! "<<i<<endl;
			return;
		}
	}
	cout<<"? "<<2*n-3<<' '<<2*n<<endl;
	int res;
	cin>>res;
	if(res==1){
		cout<<"! "<<2*n-3<<endl;
		return;
	}
	cout<<"? "<<2*n-2<<' '<<2*n<<endl;
	cin>>res;
	if(res==1){
		cout<<"! "<<2*n-2<<endl;
		return;
	}	
	cout<<"! "<<2*n-1<<endl;
	return;
}

signed main(){
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t = 1;
    cin >> t;
    while(t--){
        solve();
    }
}
```



## 反思

构造题可以先想想自己暴力判断出来的极限方法，然后再优化，本题可以先想n+2次数查找出来再想怎么优化，但整体偏难。构造还是太弱了。
