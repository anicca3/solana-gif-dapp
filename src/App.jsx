import React, { useEffect, useState } from 'react';
import githubLogo from './assets/github.svg';
import './App.css';

import { Connection, PublicKey, clusterApiUrl} from '@solana/web3.js';
import { Program, Provider, web3 } from '@project-serum/anchor';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import idl from './idl.json';
import kp from './keypair.json';

// Constants
const GITHUB_HANDLE = 'anicca3';
const GITHUB_LINK = `https://github.com/${GITHUB_HANDLE}`;
const CREATOR_NAME = 'anicca';

// SystemProgram is a reference to the Solana runtime
const { SystemProgram, Keypair } = web3;

// Create a keypair for the account that will hold the GIF data
const arr = Object.values(kp._keypair.secretKey);
const secret = new Uint8Array(arr);
const baseAccount = web3.Keypair.fromSecretKey(secret);

// Get our program's id from the IDL file
const programID = new PublicKey(idl.metadata.address);

// See our network to devnet
const network = clusterApiUrl('devnet');

// Controls how we want to acknowledge when a transaction is "done"
// Do we want to wait for one node to acknowledge our transaction or the whole Solana chain?
const opts = {
  preflightCommitment: "processed" // vs. finalized
}

const App = () => {

  const [walletAddress, setWalletAddress] = useState(null);
  const [inputValue, setInputValue] = useState('https://media.giphy.com/media/KhNxr5hsrljL0Ynsz4/giphy.gif');
  const [gifList, setGifList] = useState([]);

  const TEST_GIFS = [
    'https://media.giphy.com/media/26BRCJC7IaqO7efLy/giphy.gif',
    'https://media.giphy.com/media/xT1XGOGdyDrL2BTfxK/giphy.gif',
    'https://media.giphy.com/media/mXuPwP0kxQqvu0M168/giphy.gif'
  ];

  const checkIfWalletIsConnected = async () => {
    try {
      const { solana } = window;
      if(solana) {
        console.log('solana object found');
        if (solana.isPhantom) {
          console.log('Phantom wallet found');
          const response = await solana.connect({ onlyIfTrusted: true });
          console.log(
            'Connected with Public Key:',
            response.publicKey.toString()
          );
          setWalletAddress(response.publicKey.toString());
        }
      } else {
        console.log('solana object not found. Get a Phantom wallet.');
      }
    } catch (error) {
      console.error(error);
    }
  }

  const connectWallet = async () => {
    const { solana } = window;
    if(solana) {
      const response = await solana.connect();
      console.log(
        'Connected with Public Key:',
        response.publicKey.toString()
      );
      setWalletAddress(response.publicKey.toString());
    }
  }

  const renderNotContainedContainer = () => (
    <button
      className="cta-button connect-wallet-button"
      onClick={connectWallet}
    >
      Connect to Wallet
    </button>
  );

  const renderConnectedContainer = () => {
    // If we hit this, it means the program account hasn't been initialized.
    if (gifList === null) {
      return (
        <div className="connected-container">
          <button className="cta-button submit-gif-button" onClick={createGifAccount}>
            Do One-Time Initialization For GIF Program Account
          </button>
        </div>
      )
    } 
    // Otherwise, we're good! Account exists. User can submit GIFs.
    else {
      return (
        <div className="connected-container">
          <form
            onSubmit={sendGif}
          >
            <input type="text" placeholder="Enter gif link!" value={inputValue} onChange={onInputChange} />
            <button type="submit" className="cta-button submit-gif-button">Submit</button>
          </form>
          <div className="gif-grid">
            {gifList.map((item, index) => (
              <div className="gif-item" key={index}>
                <img src={item.gifLink} />
                <p>📨{item.userAddress.toString()}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // Similar to eth, we get the provider from the wallet
  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection, window.solana, opts.preflightCommitment
    );
    return provider;
  }

  // Form helpers
  const onInputChange = (e) => {
    setInputValue(e.target.value);
  }

  const sendGif = async (e) => {
    e.preventDefault();
    if (inputValue.length === 0) {
      console.log("No gif link given!")
      return
    }
    setInputValue('');
    console.log('Gif link:', inputValue);
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      console.log(baseAccount.publicKey);
      console.log(provider.wallet.publicKey);
      await program.rpc.addGif(inputValue, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        },
      });

      console.log("GIF successfully sent to program", inputValue)

      await getGifList();
    } catch (error) {
      console.log("Error sending GIF:", error);
      alert('fal');
    }
  };

  // baseAccount and user are both accounts
  // baseAccount is the one that hold the data
  // user is the one who connected the wallet
  const createGifAccount = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      await program.rpc.startStuffOff({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount]
      });
      console.log("Created a new BaseAccount w/ address:", baseAccount.publicKey.toString())
      await getGifList();
    } catch (error) {
      console.log("Error creating BaseAccount account:", error);
    }
  }

  const getGifList = async() => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
      
      console.log("Got the account", account);
      setGifList(account.gifList);

    } catch (error) {
      console.log("Error in getGifList: ", error)
      setGifList(null); 
    }
  }

  useEffect(() => {
    // Phantom wallet team suggests to wait for the window to FULLY finish loading so we add the listener like this:
    const onLoad = async () => {
      await checkIfWalletIsConnected();
    }
    window.addEventListener('load', onLoad);
    return () => { window.removeEventListener('load', onLoad)}
  }, []);

  useEffect(() => {
    if (walletAddress) {
      console.log('Fetching gifs...');
      // Call solana program here
      getGifList();
    }
  }, [walletAddress])

  return (
    <div className="App">
    	<div className={walletAddress ? 'authed-container' : 'container'}>
        <div className="container">
          <div className="header-container">
            <p className="header">🖼 OnDeck </p>
            <p className="sub-text">
              Leave a message in the OnDeck metaverse ✨
            </p>
            {/* Render your connect to wallet button right here */}
            {!walletAddress && renderNotContainedContainer()}
            {walletAddress && renderConnectedContainer()}
          </div>
          <div className="footer-container">
            <img alt="Github Logo" className="github-logo" src={githubLogo} />
            <a
              className="footer-text"
              href={GITHUB_LINK}
              target="_blank"
              rel="noreferrer"
            >{`built by @${CREATOR_NAME}`}</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
