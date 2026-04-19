# Block Party

Block Party is a ticketing protocol and SDK that runs on the XRP ledger to permanently end secondary ticket markets. Scalpers are blocked, fans pay face value, and artists capture the true value of their work.

## The Problem

Fans wait years to see their favorite artists perform live, only to be beaten by resellers and bots within seconds. Those tickets are then sold third-party at an average of 65% above the sale price. 

Historically, hundreds of blockchain solutions have tried their hand at "fixing" the systemic problems behind secondary markets. The common denominator between these failed attempts is the fact that vendors cannot control the ownership and transfer of money surrounding the tickets once they sell it. 

## The Future

Utilizing bleeding-edge functionalities from XRPL, Block Party completely redefines ticketing by removing the ability to resell entirely. It's a multi-step process:

1. Fans' accounts are first verified using Decentralized IDs, which simultaneously stop scalpers from making multiple accounts while signing the real accounts with a verification flag. 
2. When fans buy tickets through a vendor that uses Block Party, their money goes across the blockchain as RLUSD, a regulated stablecoin by Ripple.
3. Once the vendor receives the RLUSD payment, they mint a Multi-Purpose Token (MPT) -- the digital right to the ticket -- and send it back to the fan.
4. The MPT now cannot be transferred to anyone else's account. Hooks enforce this logic, only allowing returns back to the vendor at a 2% fee (which primarily goes back to the artist).
5. If a fan was not able to get an MPT in time, they can enter the waitlist. This works via an Escrow, where prepayments are held on the blockchain until someone returns their ticket. Once that happens, a Batch atomically refunds the original purchaser, takes the fee, reassigns the MPT to the fan on the waitlist, and takes the RLUSD that was held in the Escrow. 

## So I Can't Buy For My Friends?

You can! The way that this process is executed cleverly allows you to buy for your friends while not allowing loopholes to backdoor ticket payments. It's simple:

- Your friend group pre-declares that you will buy tickets (MPTs) for each other.
- If one friend makes it in, they can then buy as many MPTs as are in their friend group (up to 10).
- The MPTs are automatically minted and sent to each friends' wallet, awaiting acceptance from them when they get off work.

After this, the MPTs belong to each friend and cannot be transferred any longer (besides returns).

## Why Can't I Just Give My Friend My Account Login?

The authentication on your account stops this. 

The Decentralized IDs are checked at login every time. That means, identity verification must happen at the time of redemption. Good luck getting your identification to work with your friend's account!

## How To Start

The primary benefit of this repo is the SDK, which routes logic for ticket sellers through the blockchain lifecycle and auditing. However, due to the novelty of the features, it will currently run on a local instance of XRPL. Here are some rough steps and references on how you can get this working yourself (and play around with these new features, too!):

1. The XRPL code comes from [this](#https://github.com/XRPLF/rippled) repo. [This](#https://xrpl.org/docs/concepts/networks-and-servers/rippled-server-modes) link describes the different modes for XRPLF. This project uses the `standalone mode` so it can use `Amendments`.
2. Before you build the code, you will need to ensure that you include the Amendments in the source code. Once they are included, reference [this](#https://github.com/XRPLF/rippled/blob/develop/BUILD.md) page to see how to build the program locally. You will need a complete C++ build environment. Just because the Amendments are included doesn't mean they are turned on -- double check!
3. Now, you can spin up the server. Point the SDK at the server and run it. The SDK comes with a handful of testing functions to check that everything is working properly:

  ``` bash
  npm run audit:credential-auth
  npm run audit:permissioned-domain
  npm run audit:native-batch
  npm run audit:primary-policy
  ```
4. Voila! You can, as a final step, connect your local server address to [this](#https://livenet.xrpl.org/) website, which will visualize the ledger transactions across your local instance. Now build away!

## Authors
This project was authored by Nathan McCormick, Adam Alkawaz, and Ogochukwu Ibe-Ikechi at the University of Kansas' HackKU hackathon on April 17 - 19, 2026. We pursued the Ripple sponsor track, which involved building cutting-edge technology on the XRP blockchain to solve real world problems. Block Party was brought from ideation to production in less than 36 hours. 
