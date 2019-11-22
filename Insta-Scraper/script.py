from requestium import Session, Keys
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
import os
from os.path import join
import platform
import json
import hashlib
import hmac
import time
import six.moves.urllib as urllib
from tqdm import tqdm
from API import API
import pickle

def findPathForDriver():
    lookfor = "chromedriver.exe" if platform.system() == "Windows" else "chromedriver"
    placeWhereToStart = "C:\\" if platform.system() == "Windows" else "/"
    for root, dirs, files in os.walk(placeWhereToStart):
        if lookfor in files:
            return join(root, lookfor)
            

def generate_device_id(seed):
    volatile_seed = "12345"
    m = hashlib.md5()
    m.update(seed.encode('utf-8') + volatile_seed.encode('utf-8'))
    return 'android-' + m.hexdigest()[:16]
 
def generate_UUID(uuid_type):
    import uuid
    generated_uuid = str(uuid.uuid4())
    if uuid_type:
        return generated_uuid
    else:
        return generated_uuid.replace('-', '')
 
def get_seed(*args):
    m = hashlib.md5()
    m.update(b''.join([arg.encode('utf-8') for arg in args]))
    return m.hexdigest()

def login():
    global api
    api.s.driver.get("https://www.instagram.com/accounts/login")
    time.sleep(2)
    api.s.driver.find_element_by_xpath("//*[@name='username']").send_keys("tylie77221")
    api.s.driver.find_element_by_xpath("//*[@name='password']").send_keys("tylie772211")
    api.s.driver.find_element_by_css_selector('button._0mzm-.sqdOP.L3NKy').click()
    time.sleep(2)
    print("LOGIN CARRIED OUT WITH SUCCESS. STARTING THE LOGGER....")


def scrapeAccountName():
    global api
    return api.s.driver.find_element_by_css_selector('h1._7UhW9.fKFbl.yUEEX.KV-D4.fDxYl').text.split('\n')[0]

def scrapeFollowersFromAnAccount(mode="followers"):
    """Temporary - Will be more generic"""
    global api
    api.s.driver.get("https://www.instagram.com/" + Target_User) 
    usernameToLook = scrapeAccountName() #The idea is by searching for hashtag, you want to do the scraping of any user
    api.s.transfer_driver_cookies_to_session()
    usernameToLook = api.castUsernameToUserID(usernameToLook) #Same as the previous comment
    username = "tylie77221"
    password = "tylie772211"
    device_id = generate_device_id(get_seed(username, password))
    uuid = generate_UUID(True)
    rank_token = "{}_{}".format(usernameToLook, uuid)
    return api.getUserFollowers(usernameToLook, rank_token, selection=mode)

def scrapeFollowingFromAnAccount():
    """Temporary - will be more generic"""
    global api

def executeLikesOnPhotos(quantity):
    """To generalize, for now it puts like only on the global grid"""
    global api
    x = 0 
    time.sleep(2)
    element = api.s.driver.find_element_by_xpath("//*[contains(@href, '/?tagged=rugby')]")
    element.click()
    while x != int(quantity):
        #elements = context.webdriver.find_elements_by_xpath("//*[@class='_mck9w _gvoze _tn0ps']")
        time.sleep(2)
        try:
            api.s.driver.find_element_by_css_selector(".coreSpriteHeartOpen").click()
            api.logger.info("Successfully liked the photo")
            followUser()
            #Enter follow function here
        except Exception:
            api.logger.error("No action has been done. Perhaps the photo has been liked before? Continue...")
            ActionChains(api.s.driver).send_keys(Keys.RIGHT).perform()
            continue
        x+=1
        ActionChains(api.s.driver).send_keys(Keys.RIGHT).perform()
        time.sleep(2)
 
def followUser(userToFollow = None):
    global api
    #import inspect
    #userToFollow = inspect.stack()[1][3]
    if userToFollow is None:
        userToFollow = api.s.driver.find_element_by_xpath("//*[contains(@class,'notranslate')]").text
    api.s.driver.execute_script('''window.open("about:blank", "_blank");''')
    api.logger.info("Opening a new window to follow the user")
    api.s.driver.switch_to.window(api.s.driver.window_handles[-1])
    api.logger.info("Successfully switch the focus to the new window. Loading the page...")
    api.s.driver.get("https://www.instagram.com/"+userToFollow)
    time.sleep(1)
    try:
        api.s.driver.find_element_by_xpath("//*[contains(text(), 'Follow')]").click()
        time.sleep(1.5)
        api.logger.info("User " + userToFollow + " followed successfully. Closing of this tab and switching to the previous one")
        api.s.driver.execute_script("close();")
        api.s.driver.switch_to.window(api.s.driver.window_handles[-1])
    except Exception:
        api.logger.warning("Impossible to follow " +userToFollow + ". Perhaps you are already following this user?")

def insertComment():
    """Should add a way to insert more 'not-bot-like' comments"""
    global api
    api.s.driver.find_element_by_xpath("//*[@class='_bilrf']").send_keys("💪🏻")
    api.s.driver.find_element_by_xpath("//*[@class='_bilrf']").send_keys(Keys.ENTER)

def testStories():
    global api
    api.s.transfer_driver_cookies_to_session()
    toSee = api.seeStories()
    with open("savedJson.txt", "w") as f:
        import json
        f.write(json.dumps(toSee, indent=2))
    print("Fatto")


def findConnections(userToLookForConnections):
    """Taking the input user and see if he has played for any team"""
    import json
    with open("filter.json", "r") as opened:
        filtering = json.load(opened) #Filter that contains all the excellent players from 2011 to 2017. Type: DICT
    for teamName, squadList in filtering.items():
        if userToLookForConnections in squadList:
            print("ciao")
            #crea arco
    return None
          


if __name__ == "__main__":
    """ How to test the addition of nodes: Open the following of an account you have (rugbyrovigodelta), 
    For each follower x in the file: 
        G.findConnections(x)
    """
    path = findPathForDriver()
    api = API(path)
    print("WELCOME TO INSTASCRIPT.")
    login()
    #testStories()

    ### ------------------> INSERT THE USER YOU WANT TO SCRAPE HERE <------------------ ###
    Target_User = "henry77221" 
    ### ------------------------------------------------------------------------------- ###

    MainTarget = Target_User
    Followers = scrapeFollowersFromAnAccount(mode="followers")
    api.saveScrapedFollowers()
    #Following = scrapeFollowersFromAnAccount(mode="following")
    #api.saveScrapedFollowing()

    text_file = open(os.getcwd()+"/ScrapedFollowers/"+ MainTarget + ".txt", "r")
    list_f = text_file.read().split(',')
    del list_f[-1]

    Following_list = []

    for i in range(len(list_f)):
        Target_User = list_f[i]
        Following = scrapeFollowersFromAnAccount(mode="following")
        api.saveScrapedFollowing()
        Following_list = Following_list + Following
        if i > 500:  ###----------------> Change the number here if its too long <--------------------###
            break
        

    with open(os.getcwd()+"/FollowingList/" + MainTarget + '_Following_list.pickle', 'wb') as f:
        pickle.dump(Following_list,f)

    #api.s.transfer_session_cookies_to_driver()
    #time.sleep(2)
    #api.s.driver.get("https://www.instagram.com/explore/tags/rugby")
    #executeLikesOnPhotos(3)
    #api.getUsernameFromID(402819190)
    #print(api.users)

    ##END FOR NOW

